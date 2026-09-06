const express = require('express');
const crypto = require('crypto');
const { collections } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { ApiError } = require('../middleware/errorHandler');
const upload = require('../middleware/upload');
const { logActivity } = require('../utils/activity');
const { nowIso } = require('../utils/dates');
const { normalizePhone, digitsOnly } = require('../utils/phone');
const { pickContact } = require('../utils/serialize');
const { readWorkbook, cleanColumns, replaceSentinels } = require('../utils/excel');
const { shopNameFromData } = require('../utils/shopName');

const router = express.Router();

// Lowercase-value -> is-blank-like set used INSIDE the import row loop.
// Case-insensitive, deliberately distinct from excel.js's EMPTY_SENTINELS.
const NAN_LIKE = new Set(['nan', 'none', 'null', 'na', 'n/a']);

// ===== POST /contacts/import =====
router.post('/contacts/import', upload.single('file'), requireAuth, async (req, res, next) => {
  try {
    const mapping = JSON.parse(req.body.column_mapping);
    const phoneColumn = mapping.phone;
    const phone2Column = mapping.phone2;
    const customerNameColumn = mapping.customer_name;

    const { columns: rawColumns, rows: rawRows } = readWorkbook(req.file.buffer);
    let { columns, rows } = cleanColumns(rawColumns, rawRows);

    const originalCount = rows.length;

    rows = replaceSentinels(rows);

    let fileDuplicatesRemoved = 0;
    if (phoneColumn && columns.includes(phoneColumn)) {
      rows = rows.map((r) => ({
        ...r,
        _normalized_phone: r[phoneColumn] != null ? normalizePhone(String(r[phoneColumn])) : '',
      }));
      rows = rows.filter((r) => r._normalized_phone !== '');
      const seen = new Set();
      const deduped = [];
      for (const r of rows) {
        if (!seen.has(r._normalized_phone)) {
          seen.add(r._normalized_phone);
          deduped.push(r);
        }
      }
      fileDuplicatesRemoved = originalCount - deduped.length;
      rows = deduped;
    }

    let importedCount = 0;
    let skippedCount = 0;
    let dbDuplicatesCount = 0;
    let emptyDataCount = 0;
    let processedCount = 0;

    // Snapshot existing contacts' phones once; matches Python's per-row full
    // scan closely enough while avoiding re-querying inside the loop for
    // contacts inserted earlier in THIS same import (Python re-queries and
    // so *does* see earlier-in-this-run insertions — replicate that by
    // refreshing the normalized-phone set as we insert).
    const existingContacts = await collections.contacts()
      .find({}, { projection: { _id: 0, phone: 1 } })
      .toArray();
    const existingNormalized = new Set(
      existingContacts.map((c) => normalizePhone(c.phone || '')).filter((p) => p !== '')
    );

    for (const row of rows) {
      processedCount += 1;
      const contactData = {};

      for (const [crmField, excelCol] of Object.entries(mapping)) {
        if (columns.includes(excelCol) && !['phone', 'phone2', 'customer_name'].includes(crmField)) {
          const value = row[excelCol];
          if (value === null || value === undefined) continue;
          const strValue = String(value).trim();
          if (strValue === '' || NAN_LIKE.has(strValue.toLowerCase())) continue;
          contactData[crmField] = strValue;
        }
      }

      let phone = null;
      if (phoneColumn && columns.includes(phoneColumn)) {
        const phoneValue = row[phoneColumn];
        if (phoneValue !== null && phoneValue !== undefined) {
          phone = String(phoneValue).trim();
        }
      }

      let customerName = null;
      if (customerNameColumn && columns.includes(customerNameColumn)) {
        const customerNameValue = row[customerNameColumn];
        if (customerNameValue !== null && customerNameValue !== undefined) {
          customerName = String(customerNameValue).trim();
        }
      }

      if (phone2Column && columns.includes(phone2Column)) {
        const phone2Value = row[phone2Column];
        if (phone2Value !== null && phone2Value !== undefined) {
          contactData.phone2 = String(phone2Value).trim();
        }
      }

      if (!phone) {
        const shopName = contactData.shop_name;
        if (shopName && shopName.trim()) {
          const cleanShop = shopName.split(' ').join('_').split('-').join('_').slice(0, 15);
          phone = `${cleanShop}_${processedCount}`;
        } else {
          phone = `contact_${processedCount}`;
        }
      }

      const normalizedPhone = normalizePhone(phone);

      if (normalizedPhone) {
        if (existingNormalized.has(normalizedPhone)) {
          dbDuplicatesCount += 1;
          skippedCount += 1;
          continue;
        }
      }

      if (Object.keys(contactData).length === 0) {
        emptyDataCount += 1;
        skippedCount += 1;
        continue;
      }

      const status = contactData.status !== undefined ? contactData.status : 'None';
      delete contactData.status;

      const contact = {
        id: crypto.randomUUID(),
        phone,
        customer_name: customerName,
        status,
        assigned_staff: null,
        assigned_staff_id: null,
        data: contactData,
        created_at: nowIso(),
        updated_at: nowIso(),
        last_call_at: null,
      };

      await collections.contacts().insertOne(contact);
      if (normalizedPhone) existingNormalized.add(normalizedPhone);
      importedCount += 1;
    }

    await logActivity(
      req.user.id,
      req.user.email,
      'Imported contacts',
      null,
      `Imported ${importedCount} contacts, skipped ${skippedCount} (duplicates: ${dbDuplicatesCount}, empty: ${emptyDataCount}, file duplicates removed: ${fileDuplicatesRemoved})`
    );

    res.json({
      message: 'Import completed',
      imported: importedCount,
      skipped: skippedCount,
      file_duplicates_removed: fileDuplicatesRemoved,
      db_duplicates: dbDuplicatesCount,
      empty_data_skipped: emptyDataCount,
      total_processed: processedCount,
      original_excel_rows: originalCount,
    });
  } catch (err) {
    next(new ApiError(400, err.message));
  }
});

// ===== POST /contacts/preview =====
router.post('/contacts/preview', upload.single('file'), requireAuth, async (req, res, next) => {
  try {
    const { columns: rawColumns, rows: rawRows } = readWorkbook(req.file.buffer, { nrows: 5 });
    let { columns, rows } = cleanColumns(rawColumns, rawRows);
    rows = replaceSentinels(rows);

    const suggestedMapping = {};
    for (const col of columns) {
      const colLower = col.toLowerCase().trim();
      if (['shop name', 'shopname', 'shop_name', 'business name'].includes(colLower)) {
        suggestedMapping[col] = 'shop_name';
      } else if (
        ['customer name', 'customername', 'customer_name', 'name', 'client name', 'owner name'].includes(colLower)
      ) {
        suggestedMapping[col] = 'customer_name';
      } else if (['street', 'address', 'location', 'addr'].includes(colLower)) {
        suggestedMapping[col] = 'address';
      } else if (
        ['phone number', 'phone_number', 'phone', 'mobile', 'contact', 'contact number'].includes(colLower)
      ) {
        suggestedMapping[col] = 'phone';
      } else if (colLower === 'city') {
        suggestedMapping[col] = 'city';
      } else if (colLower === 'state') {
        suggestedMapping[col] = 'state';
      } else if (colLower === 'status') {
        suggestedMapping[col] = 'status';
      } else if (['category', 'type', 'classification'].includes(colLower)) {
        suggestedMapping[col] = 'category';
      } else {
        suggestedMapping[col] = '';
      }
    }

    res.json({
      columns,
      sample_data: rows,
      suggested_mapping: suggestedMapping,
    });
  } catch (err) {
    next(new ApiError(400, err.message));
  }
});

// Field-name variants searched inside data.* when a text search doesn't
// resolve to phone matches. Transcribed verbatim from the Python source.
const DATA_SEARCH_FIELDS = [
  'shop_name', 'Shop_Name', 'Shop Name', 'shopName', 'SHOP_NAME',
  'business_name', 'Business_Name', 'Business Name', 'businessName', 'BUSINESS_NAME',
  'shop', 'Shop', 'SHOP', 'store_name', 'Store_Name', 'Store Name', 'storeName',
  'name', 'Name', 'NAME', 'customer_name', 'Customer_Name', 'Customer Name', 'customerName',
  'owner_name', 'Owner_Name', 'Owner Name', 'ownerName', 'OWNER_NAME',
  'contact_person', 'Contact_Person', 'Contact Person', 'contactPerson',
  'address', 'Address', 'ADDRESS', 'full_address', 'Full_Address', 'Full Address', 'fullAddress',
  'city', 'City', 'CITY', 'state', 'State', 'STATE', 'location', 'Location', 'LOCATION',
  'company', 'Company', 'COMPANY', 'firm', 'Firm', 'FIRM',
  'organization', 'Organization', 'ORGANIZATION', 'title', 'Title', 'TITLE',
];

// ===== GET /contacts =====
router.get('/contacts', requireAuth, async (req, res, next) => {
  try {
    const skip = parseInt(req.query.skip, 10) || 0;
    const limit = req.query.limit !== undefined ? parseInt(req.query.limit, 10) : 100;
    const search = req.query.search;
    const status = req.query.status;

    let query = {};

    if (search) {
      const searchDigits = digitsOnly(search);
      const searchConditions = [{ customer_name: { $regex: search, $options: 'i' } }];

      if (searchDigits) {
        const allContacts = await collections.contacts().find(
          {},
          {
            projection: {
              _id: 0, id: 1, phone: 1, customer_name: 1, status: 1, data: 1,
              assigned_staff: 1, assigned_staff_id: 1, created_at: 1, updated_at: 1, last_call_at: 1,
            },
          }
        ).toArray();

        const matchingIds = [];
        for (const c of allContacts) {
          const phoneDigits = digitsOnly(c.phone || '');
          if (phoneDigits.includes(searchDigits)) {
            matchingIds.push(c.id);
          }
        }

        if (matchingIds.length > 0) {
          query = status
            ? { id: { $in: matchingIds }, status }
            : { id: { $in: matchingIds } };

          const contacts = await collections.contacts()
            .find(query, { projection: { _id: 0 } })
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(limit)
            .toArray();
          return res.json(contacts.map(pickContact));
        }
      }

      for (const field of DATA_SEARCH_FIELDS) {
        searchConditions.push({ [`data.${field}`]: { $regex: search, $options: 'i' } });
      }
      query.$or = searchConditions;
    }

    if (status) {
      query.status = status;
    }

    const contacts = await collections.contacts()
      .find(query, { projection: { _id: 0 } })
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
    res.json(contacts.map(pickContact));
  } catch (err) {
    next(new ApiError(500, `Database query error: ${err.message}`));
  }
});

// ===== GET /contacts/debug-data =====
router.get('/contacts/debug-data', requireAuth, async (req, res, next) => {
  try {
    const contacts = await collections.contacts()
      .find({}, { projection: { _id: 0 } })
      .limit(5)
      .toArray();
    const result = contacts.map((c) => ({
      phone: c.phone,
      customer_name: c.customer_name,
      data_keys: c.data ? Object.keys(c.data) : [],
      sample_data: c.data || {},
    }));
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ===== GET /contacts/count =====
router.get('/contacts/count', requireAuth, async (req, res, next) => {
  try {
    const total = await collections.contacts().countDocuments({});
    const byStatus = await collections.contacts().aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]).toArray();

    const byStatusObj = {};
    for (const item of byStatus) {
      byStatusObj[item._id] = item.count;
    }

    res.json({ total, by_status: byStatusObj });
  } catch (err) {
    next(err);
  }
});

// ===== POST /contacts =====
router.post('/contacts', requireAuth, async (req, res, next) => {
  try {
    const { phone, customer_name, status, data } = req.body || {};

    const normalizedNewPhone = normalizePhone(phone);
    if (normalizedNewPhone) {
      const existingContacts = await collections.contacts()
        .find({}, { projection: { _id: 0, phone: 1 } })
        .toArray();
      for (const existing of existingContacts) {
        if (normalizePhone(existing.phone || '') === normalizedNewPhone) {
          throw new ApiError(
            400,
            `Contact with this phone number already exists (found: ${existing.phone})`
          );
        }
      }
    }

    const contact = {
      id: crypto.randomUUID(),
      phone,
      customer_name: customer_name ?? null,
      status: status || 'None',
      assigned_staff: null,
      assigned_staff_id: null,
      data: data || {},
      created_at: nowIso(),
      updated_at: nowIso(),
      last_call_at: null,
    };
    await collections.contacts().insertOne(contact);

    const shopName = shopNameFromData(contact.data);
    const customerNameLog = contact.customer_name || 'Unknown Customer';

    await logActivity(
      req.user.id,
      req.user.email,
      'Created contact',
      contact.phone,
      `Customer: ${customerNameLog}, Shop: ${shopName}, Phone: ${contact.phone}`,
      shopName
    );

    res.json(pickContact(contact));
  } catch (err) {
    next(err);
  }
});

// ===== GET /contacts/:contact_id =====
router.get('/contacts/:contact_id', requireAuth, async (req, res, next) => {
  try {
    const contact = await collections.contacts().findOne(
      { id: req.params.contact_id },
      { projection: { _id: 0 } }
    );
    if (!contact) throw new ApiError(404, 'Contact not found');
    res.json(pickContact(contact));
  } catch (err) {
    next(err);
  }
});

// ===== PUT /contacts/:contact_id =====
router.put('/contacts/:contact_id', requireAuth, async (req, res, next) => {
  try {
    const contactId = req.params.contact_id;
    const contact = await collections.contacts().findOne({ id: contactId }, { projection: { _id: 0 } });
    if (!contact) throw new ApiError(404, 'Contact not found');

    const body = req.body || {};
    const updateData = {};
    for (const key of ['phone', 'customer_name', 'status', 'data']) {
      if (body[key] !== undefined && body[key] !== null) {
        updateData[key] = body[key];
      }
    }
    updateData.updated_at = nowIso();

    // Auto-assign an unassigned contact to whoever first edits it — any
    // field, not just a status change from None. Once assigned_staff is
    // set, it never gets silently overwritten by a later editor (a real
    // reassignment goes through the dedicated PUT /users/.../role-style
    // assignment flow, not this general update route). This also drives
    // the Productivity "Fresh Calls" metric (see backend-node/CLAUDE.md) —
    // it counts contacts moving from unassigned to assigned, so widening
    // the trigger from "status change" to "any edit" is intentional: any
    // edit of a previously-untouched contact should count as a fresh call.
    const isFreshAssignment = !contact.assigned_staff;
    if (isFreshAssignment) {
      const staffName = req.user.email.split('@')[0];
      updateData.assigned_staff = staffName;
      updateData.assigned_staff_id = req.user.id;
    }

    await collections.contacts().updateOne({ id: contactId }, { $set: updateData });

    const updateDataForLog = updateData.data || {};
    const contactDataForLog = contact.data || {};
    const shopName =
      updateDataForLog.shop_name ||
      contactDataForLog.shop_name ||
      contactDataForLog.Shop_Name ||
      contactDataForLog['Shop Name'] ||
      'Unknown Shop';
    const customerName = updateData.customer_name || contact.customer_name || 'Unknown Customer';

    // When status is one of the changed fields, surface the actual new
    // value in the log details (e.g. "Status changed to: Interested")
    // instead of just listing "status" among the changed field names —
    // formatDetails()/activityFormatters.js on the frontend special-cases
    // this "status changed to" phrasing to show it directly in the
    // Activity Log and the ContactDetailModal's Activity panel.
    const detailsText =
      updateData.status !== undefined
        ? `Customer: ${customerName}, Shop: ${shopName}, Status changed to: ${updateData.status}`
        : `Customer: ${customerName}, Shop: ${shopName}, Fields: ${Object.keys(updateData).join(', ')}`;

    await logActivity(
      req.user.id,
      req.user.email,
      'Updated contact',
      contact.phone,
      detailsText,
      shopName
    );

    // Logged as its OWN activity entry (action: 'Assigned contact'), not
    // folded into the 'Updated contact' details string above — the
    // Productivity "Fresh Calls" metric (backend-node/CLAUDE.md) queries
    // this action directly instead of regex-matching free text. The
    // previous approach (checking for the literal substring "assigned_staff"
    // inside 'Updated contact' details) silently broke the day the details
    // string started saying "Status changed to: X" instead of listing
    // "Fields: status, assigned_staff, ..." for the common case where a
    // fresh assignment happens alongside a status change — meaning Fresh
    // Calls under-counted for any edit that also changed status, which is
    // the normal path. A dedicated action string can't be broken by an
    // unrelated wording change to a different log message.
    if (isFreshAssignment) {
      await logActivity(
        req.user.id,
        req.user.email,
        'Assigned contact',
        contact.phone,
        `Customer: ${customerName}, Shop: ${shopName}, Assigned to: ${updateData.assigned_staff}`,
        shopName
      );
    }

    const updatedContact = await collections.contacts().findOne({ id: contactId }, { projection: { _id: 0 } });
    res.json(pickContact(updatedContact));
  } catch (err) {
    next(err);
  }
});

// ===== DELETE /contacts/:contact_id =====
router.delete('/contacts/:contact_id', requireAuth, async (req, res, next) => {
  try {
    const contactId = req.params.contact_id;
    const contact = await collections.contacts().findOne({ id: contactId }, { projection: { _id: 0 } });
    if (!contact) throw new ApiError(404, 'Contact not found');

    const contactData = contact.data || {};
    const shopName =
      contactData.shop_name ||
      contactData.Shop_Name ||
      contactData['Shop Name'] ||
      contactData.shop ||
      contactData.Shop ||
      contact.shop_name ||
      contact.Shop_Name ||
      'Unknown Shop';
    const customerName = contact.customer_name || 'Unknown Customer';

    await collections.contacts().deleteOne({ id: contactId });

    await logActivity(
      req.user.id,
      req.user.email,
      'Deleted contact',
      contact.phone,
      `Customer: ${customerName}, Shop: ${shopName}, Phone: ${contact.phone}`,
      shopName
    );

    res.json({ message: 'Contact deleted successfully' });
  } catch (err) {
    next(err);
  }
});

// ===== POST /contacts/:contact_id/call =====
router.post('/contacts/:contact_id/call', requireAuth, async (req, res, next) => {
  try {
    const contactId = req.params.contact_id;
    const contact = await collections.contacts().findOne({ id: contactId }, { projection: { _id: 0 } });
    if (!contact) throw new ApiError(404, 'Contact not found');

    const callTime = nowIso();
    await collections.contacts().updateOne({ id: contactId }, { $set: { last_call_at: callTime } });

    await logActivity(
      req.user.id,
      req.user.email,
      'Called contact',
      contact.phone,
      `Call made at ${callTime}`,
      shopNameFromData(contact.data)
    );

    res.json({ message: 'Call logged successfully', call_time: callTime });
  } catch (err) {
    next(err);
  }
});

module.exports = { router, shopNameFromData };
