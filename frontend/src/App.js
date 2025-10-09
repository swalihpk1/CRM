import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import axios from 'axios';
import '@/App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Helper function to format dates in 12-hour format
const format12Hour = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

// Helper functions for contact and follow-up display
const getContactName = (followup) => {
  if (followup.contact) {
    const name = followup.contact.data?.name || followup.contact.data?.Name || followup.contact.phone;
    const shopName = followup.contact.data?.shop_name || followup.contact.data?.Shop_Name || followup.contact.data?.['Shop Name'];
    return shopName ? `${shopName} (${name})` : name;
  }
  return followup.contact_id;
};

const getContactPhone = (followup) => {
  return followup.contact?.phone || 'N/A';
};

// Auth Context
const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`);
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const response = await axios.post(`${API}/auth/login`, { email, password });
    const { token: newToken, user: userData } = response.data;
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(userData);
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
  };

  const signup = async (email, password) => {
    const response = await axios.post(`${API}/auth/signup`, { email, password });
    const { token: newToken, user: userData } = response.data;
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(userData);
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => useContext(AuthContext);

// Login/Signup Component
const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, signup } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await signup(email, password);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Authentication failed');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-indigo-600 mb-2">SmartCRM</h1>
          <p className="text-gray-600">Manage your contacts efficiently</p>
        </div>
        
        <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setIsLogin(true)}
            className={`flex-1 py-2 rounded-md transition ${isLogin ? 'bg-white shadow text-indigo-600 font-semibold' : 'text-gray-600'}`}
          >
            Login
          </button>
          <button
            onClick={() => setIsLogin(false)}
            className={`flex-1 py-2 rounded-md transition ${!isLogin ? 'bg-white shadow text-indigo-600 font-semibold' : 'text-gray-600'}`}
          >
            Sign Up
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition font-semibold"
          >
            {isLogin ? 'Login' : 'Sign Up'}
          </button>
        </form>
      </div>
    </div>
  );
};

// Main Dashboard Component
const Dashboard = () => {
  const { logout } = useAuth();
  const [view, setView] = useState('dashboard');
  const [contacts, setContacts] = useState([]);
  const [stats, setStats] = useState({ total: 0, by_status: {} });
  const [followups, setFollowups] = useState({ overdue: [], upcoming: [] });
  const [activityLogs, setActivityLogs] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [contactsPage, setContactsPage] = useState(0);
  const [hasMoreContacts, setHasMoreContacts] = useState(true);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [followupsPage, setFollowupsPage] = useState(0);
  const [hasMoreFollowups, setHasMoreFollowups] = useState(true);
  const [loadingFollowups, setLoadingFollowups] = useState(false);
  const [allFollowups, setAllFollowups] = useState([]);
  const [activityLogsPage, setActivityLogsPage] = useState(0);
  const [hasMoreActivityLogs, setHasMoreActivityLogs] = useState(true);
  const [loadingActivityLogs, setLoadingActivityLogs] = useState(false);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/contacts/count`);
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchContacts = async (page = 0, reset = false) => {
    if (loadingContacts) return;
    
    try {
      setLoadingContacts(true);
      const params = new URLSearchParams();
      params.append('skip', page * 20);
      params.append('limit', '20');
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter) params.append('status', statusFilter);
      
      const response = await axios.get(`${API}/contacts?${params}`);
      const newContacts = response.data;
      
      if (reset || page === 0) {
        setContacts(newContacts);
      } else {
        setContacts(prev => [...prev, ...newContacts]);
      }
      
      setHasMoreContacts(newContacts.length === 20);
      setContactsPage(page);
    } catch (error) {
      console.error('Failed to fetch contacts:', error);
    } finally {
      setLoadingContacts(false);
    }
  };

  const fetchFollowups = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/followups/upcoming`);
      setFollowups(response.data);
    } catch (error) {
      console.error('Failed to fetch follow-ups:', error);
    }
  }, []);

  const fetchActivityLogs = useCallback(async (page = 0, reset = false) => {
    setLoadingActivityLogs(prev => {
      if (prev) return prev; // If already loading, don't start another request
      return true;
    });
    
    try {
      const params = new URLSearchParams();
      params.append('skip', page * 20);
      params.append('limit', '20');
      
      const response = await axios.get(`${API}/activity-logs?${params}`);
      const newLogs = response.data;
      
      if (reset || page === 0) {
        setActivityLogs(newLogs);
      } else {
        setActivityLogs(prev => [...prev, ...newLogs]);
      }
      
      setHasMoreActivityLogs(newLogs.length === 20);
      setActivityLogsPage(page);
    } catch (error) {
      console.error('Failed to fetch activity logs:', error);
    } finally {
      setLoadingActivityLogs(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchContacts(0, true);
    fetchFollowups();
    fetchPaginatedFollowups(0, 'all', true);
    fetchActivityLogs(0, true);
    
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    
    // Check for follow-ups every minute
    const interval = setInterval(checkFollowupAlerts, 60000);
    return () => clearInterval(interval);
  }, []); // Empty dependency array - only run once on mount

  const resetContacts = async () => {
    setContactsPage(0);
    setHasMoreContacts(true);
    await fetchContacts(0, true);
  };

  const resetActivityLogs = async () => {
    setActivityLogsPage(0);
    setHasMoreActivityLogs(true);
    await fetchActivityLogs(0, true);
  };
  
  // Make fetchFollowups and resetActivityLogs available globally for live updates
  useEffect(() => {
    window.refreshFollowups = () => fetchFollowups();
    window.refreshActivityLogs = () => resetActivityLogs();
    return () => {
      delete window.refreshFollowups;
      delete window.refreshActivityLogs;
    };
  }, []); // Empty dependency - use arrow functions to always call current function references

  const loadMoreContacts = useCallback(async () => {
    if (hasMoreContacts && !loadingContacts) {
      await fetchContacts(contactsPage + 1, false);
    }
  }, [hasMoreContacts, loadingContacts, contactsPage]);

  const fetchPaginatedFollowups = async (page = 0, dateFilter = 'all', reset = false) => {
    if (loadingFollowups) return;
    
    try {
      setLoadingFollowups(true);
      const params = new URLSearchParams();
      params.append('skip', page * 20);
      params.append('limit', '20');
      params.append('date_filter', dateFilter);
      
      const response = await axios.get(`${API}/followups/paginated?${params}`);
      const newFollowups = response.data;
      
      if (reset || page === 0) {
        setAllFollowups(newFollowups);
      } else {
        setAllFollowups(prev => [...prev, ...newFollowups]);
      }
      
      setHasMoreFollowups(newFollowups.length === 20);
      setFollowupsPage(page);
    } catch (error) {
      console.error('Failed to fetch follow-ups:', error);
    } finally {
      setLoadingFollowups(false);
    }
  };

  const loadMoreFollowups = async (dateFilter = 'all') => {
    if (hasMoreFollowups && !loadingFollowups) {
      await fetchPaginatedFollowups(followupsPage + 1, dateFilter, false);
    }
  };

  const resetFollowups = async (dateFilter = 'all') => {
    setFollowupsPage(0);
    setHasMoreFollowups(true);
    await fetchPaginatedFollowups(0, dateFilter, true);
  };

  const loadMoreActivityLogs = useCallback(async () => {
    if (hasMoreActivityLogs && !loadingActivityLogs) {
      await fetchActivityLogs(activityLogsPage + 1, false);
    }
  }, [hasMoreActivityLogs, loadingActivityLogs, activityLogsPage]);

  const checkFollowupAlerts = async () => {
    try {
      const response = await axios.get(`${API}/followups/upcoming`);
      const { overdue } = response.data;
      
      if (overdue.length > 0 && 'Notification' in window && Notification.permission === 'granted') {
        overdue.forEach(followup => {
          new Notification('Follow-up Reminder', {
            body: `You have an overdue follow-up for contact ID: ${followup.contact_id}`,
            icon: '/favicon.ico'
          });
        });
      }
    } catch (error) {
      console.error('Failed to check follow-ups:', error);
    }
  };

  const handleLogCall = async (contactId) => {
    try {
      await axios.post(`${API}/contacts/${contactId}/call`);
      alert('Call logged successfully!');
      resetActivityLogs();
      // Also refresh global activity logs if available
      if (window.refreshActivityLogs) {
        window.refreshActivityLogs();
      }
    } catch (error) {
      alert('Failed to log call');
    }
  };

  const handleDeleteContact = async (contactId) => {
    if (!window.confirm('Are you sure you want to delete this contact?')) return;
    
    try {
      await axios.delete(`${API}/contacts/${contactId}`);
      resetContacts();
      fetchStats();
      resetActivityLogs();
      setSelectedContact(null);
    } catch (error) {
      alert('Failed to delete contact');
    }
  };

  const handleBulkDeleteContacts = async (contactIds) => {
    if (!window.confirm(`Are you sure you want to delete ${contactIds.length} selected contact${contactIds.length !== 1 ? 's' : ''}?`)) return;
    
    try {
      // Delete all contacts in parallel
      const deletePromises = contactIds.map(contactId => 
        axios.delete(`${API}/contacts/${contactId}`)
      );
      
      await Promise.all(deletePromises);
      
      // Refresh data after successful deletion
      resetContacts();
      fetchStats();
      resetActivityLogs();
      
      return true; // Success
    } catch (error) {
      console.error('Bulk delete error:', error);
      alert('Failed to delete some contacts. Please try again.');
      return false; // Failure
    }
  };

  const handleUpdateStatus = async (contactId, status) => {
    try {
      // Optimistically update the contact in the list immediately
      setContacts(prevContacts => 
        prevContacts.map(contact => 
          contact.id === contactId ? { ...contact, status } : contact
        )
      );
      
      // Update selected contact if it's the one being modified
      if (selectedContact && selectedContact.id === contactId) {
        setSelectedContact({ ...selectedContact, status });
      }
      
      // Make API call
      await axios.put(`${API}/contacts/${contactId}`, { status });
      
      // Update stats and activity logs to reflect the change
      fetchStats();
      resetActivityLogs();
    } catch (error) {
      alert('Failed to update status');
      // Revert optimistic update on error
      resetContacts();
    }
  };

  useEffect(() => {
    if (view === 'contacts') {
      resetContacts();
    }
  }, [searchQuery, statusFilter]);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-indigo-700 text-white flex flex-col">
        <div className="p-6 border-b border-indigo-600">
          <h1 className="text-2xl font-bold">SmartCRM</h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => setView('dashboard')}
            className={`w-full text-left px-4 py-3 rounded-lg transition ${view === 'dashboard' ? 'bg-indigo-600' : 'hover:bg-indigo-600'}`}
          >
            📊 Dashboard
          </button>
          <button
            onClick={() => setView('contacts')}
            className={`w-full text-left px-4 py-3 rounded-lg transition ${view === 'contacts' ? 'bg-indigo-600' : 'hover:bg-indigo-600'}`}
          >
            👥 Contacts
          </button>
          <button
            onClick={() => setView('followups')}
            className={`w-full text-left px-4 py-3 rounded-lg transition ${view === 'followups' ? 'bg-indigo-600' : 'hover:bg-indigo-600'}`}
          >
            🔔 Follow-ups
          </button>
          <button
            onClick={() => setView('import')}
            className={`w-full text-left px-4 py-3 rounded-lg transition ${view === 'import' ? 'bg-indigo-600' : 'hover:bg-indigo-600'}`}
          >
            📤 Import
          </button>
          <button
            onClick={() => setView('activity')}
            className={`w-full text-left px-4 py-3 rounded-lg transition ${view === 'activity' ? 'bg-indigo-600' : 'hover:bg-indigo-600'}`}
          >
            📝 Activity Log
          </button>
        </nav>
        
        <div className="p-4 border-t border-indigo-600">
          <button
            onClick={logout}
            className="w-full px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg transition"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          {view === 'dashboard' && <DashboardView stats={stats} followups={followups} />}
          {view === 'contacts' && (
            <ContactsView
              contacts={contacts}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              onAddContact={() => { setSelectedContact(null); setShowContactModal(true); }}
              onSelectContact={setSelectedContact}
              onLogCall={handleLogCall}
              onUpdateStatus={handleUpdateStatus}
              onDeleteContact={handleDeleteContact}
              onBulkDeleteContacts={handleBulkDeleteContacts}
              onLoadMore={loadMoreContacts}
              hasMore={hasMoreContacts}
              loading={loadingContacts}
              onUpdate={async (updatedContact) => {
                try {
                  // Optimistically update the contact in the list immediately
                  setContacts(prevContacts => 
                    prevContacts.map(contact => 
                      contact.id === updatedContact.id ? updatedContact : contact
                    )
                  );
                  
                  // Make API call to update the contact
                  await axios.put(`${API}/contacts/${updatedContact.id}`, {
                    phone: updatedContact.phone,
                    data: updatedContact.data
                  });
                  
                  // Update stats and activity logs to reflect the change
                  fetchStats();
                  resetActivityLogs();
                } catch (error) {
                  alert('Failed to update contact');
                  // Revert optimistic update on error
                  resetContacts();
                }
              }}
            />
          )}
          {view === 'followups' && (
            <FollowUpsView
              followups={followups}
              onRefresh={fetchFollowups}
              allFollowups={allFollowups}
              onLoadMore={loadMoreFollowups}
              hasMore={hasMoreFollowups}
              loading={loadingFollowups}
              onResetFollowups={resetFollowups}
            />
          )}
          {view === 'import' && (
            <ImportView onImportComplete={() => { resetContacts(); fetchStats(); resetActivityLogs(); }} />
          )}
          {view === 'activity' && (
            <ActivityLogView 
              logs={activityLogs} 
              onLoadMore={loadMoreActivityLogs}
              hasMore={hasMoreActivityLogs}
              loading={loadingActivityLogs}
              contacts={contacts}
            />
          )}
        </div>
      </div>

      {/* Contact Detail Modal */}
      {selectedContact && (
        <ContactDetailModal
          contact={selectedContact}
          onClose={() => setSelectedContact(null)}
          onUpdate={(updates) => {
            // Optimistically update the selected contact
            setSelectedContact(prev => ({ ...prev, ...updates }));
            
            // Update in contacts list immediately
            setContacts(prevContacts => 
              prevContacts.map(contact => 
                contact.id === selectedContact.id ? { ...contact, ...updates } : contact
              )
            );
            
            // Make API call
            axios.put(`${API}/contacts/${selectedContact.id}`, updates).then(() => {
              fetchStats();
              resetActivityLogs();
            }).catch(() => {
              // Revert on error
              resetContacts();
              setSelectedContact(null);
            });
          }}
          onDelete={() => handleDeleteContact(selectedContact.id)}
          onLogCall={() => handleLogCall(selectedContact.id)}
          onUpdateStatus={(status) => handleUpdateStatus(selectedContact.id, status)}
          onFollowupCreated={fetchFollowups}
        />
      )}

      {/* Contact Create/Edit Modal */}
      {showContactModal && (
        <ContactFormModal
          onClose={() => setShowContactModal(false)}
          onSave={async (data) => {
            try {
              await axios.post(`${API}/contacts`, data);
              resetContacts();
              fetchStats();
              resetActivityLogs();
              setShowContactModal(false);
            } catch (error) {
              if (error.response?.status === 400 && error.response?.data?.detail?.includes('already exists')) {
                alert(`A contact with phone number ${data.phone} already exists in the system.`);
              } else {
                alert('Failed to create contact: ' + (error.response?.data?.detail || error.message));
              }
            }
          }}
        />
      )}
    </div>
  );
};

// Dashboard View
const DashboardView = ({ stats, followups }) => {
  const statuses = ['None', 'Called', 'Not Attending', 'Follow-up', 'Interested', 'Not Interested', 'Irrelevant', 'Logged In'];
  
  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-800 mb-6">Dashboard</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-indigo-500">
          <h3 className="text-gray-600 text-sm font-medium mb-2">Total Contacts</h3>
          <p className="text-4xl font-bold text-gray-800">{stats.total}</p>
        </div>
        
        {statuses.map(status => {
          const getStatusColors = (status) => {
            switch(status) {
              case 'None': return { bg: 'bg-gray-50', border: 'border-l-gray-400', text: 'text-gray-700', count: 'text-gray-800' };
              case 'Called': return { bg: 'bg-blue-50', border: 'border-l-blue-500', text: 'text-blue-700', count: 'text-blue-800' };
              case 'Not Attending': return { bg: 'bg-orange-50', border: 'border-l-orange-500', text: 'text-orange-700', count: 'text-orange-800' };
              case 'Follow-up': return { bg: 'bg-yellow-50', border: 'border-l-yellow-500', text: 'text-yellow-700', count: 'text-yellow-800' };
              case 'Interested': return { bg: 'bg-green-50', border: 'border-l-green-500', text: 'text-green-700', count: 'text-green-800' };
              case 'Not Interested': return { bg: 'bg-red-50', border: 'border-l-red-500', text: 'text-red-700', count: 'text-red-800' };
              case 'Irrelevant': return { bg: 'bg-purple-50', border: 'border-l-purple-500', text: 'text-purple-700', count: 'text-purple-800' };
              case 'Logged In': return { bg: 'bg-teal-50', border: 'border-l-teal-600', text: 'text-teal-700', count: 'text-teal-800' };
              default: return { bg: 'bg-white', border: 'border-l-gray-400', text: 'text-gray-600', count: 'text-gray-800' };
            }
          };
          const colors = getStatusColors(status);
          return (
            <div key={status} className={`${colors.bg} rounded-xl shadow-md p-6 border-l-4 ${colors.border}`}>
              <h3 className={`${colors.text} text-sm font-medium mb-2`}>{status}</h3>
              <p className={`text-3xl font-bold ${colors.count}`}>{stats.by_status[status] || 0}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overdue Follow-ups */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-xl font-bold text-red-600 mb-4">⚠️ Overdue Follow-ups ({followups.overdue.length})</h3>
          {followups.overdue.length === 0 ? (
            <p className="text-gray-500">No overdue follow-ups</p>
          ) : (
            <div className="space-y-3">
              {followups.overdue.slice(0, 5).map(followup => (
                <div key={followup.id} className="p-3 bg-red-50 rounded-lg border border-red-200">
                  <p className="font-medium text-gray-800">{getContactName(followup)}</p>
                  <p className="text-sm text-gray-600 mt-1">📞 {getContactPhone(followup)}</p>
                  <p className="text-sm text-gray-600">Due: {format12Hour(followup.follow_up_date)}</p>
                  {followup.notes && <p className="text-sm text-gray-500 mt-1">{followup.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Follow-ups */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-xl font-bold text-indigo-600 mb-4">📅 Upcoming Follow-ups ({followups.upcoming.length})</h3>
          {followups.upcoming.length === 0 ? (
            <p className="text-gray-500">No upcoming follow-ups</p>
          ) : (
            <div className="space-y-3">
              {followups.upcoming.slice(0, 5).map(followup => (
                <div key={followup.id} className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="font-medium text-gray-800">{getContactName(followup)}</p>
                  <p className="text-sm text-gray-600 mt-1">📞 {getContactPhone(followup)}</p>
                  <p className="text-sm text-gray-600">Due: {format12Hour(followup.follow_up_date)}</p>
                  {followup.notes && <p className="text-sm text-gray-500 mt-1">{followup.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Contacts View
const ContactsView = ({
  contacts,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  onAddContact,
  onSelectContact,
  onLogCall,
  onUpdateStatus,
  onDeleteContact,
  onBulkDeleteContacts,
  onLoadMore,
  hasMore,
  loading,
  onUpdate
}) => {
  const statuses = ['None', 'Called', 'Not Attending', 'Follow-up', 'Interested', 'Not Interested', 'Irrelevant', 'Logged In'];
  const [selectedContacts, setSelectedContacts] = useState(new Set());

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedContacts(new Set(contacts.map(contact => contact.id)));
    } else {
      setSelectedContacts(new Set());
    }
  };

  const handleSelectContact = (contactId, checked) => {
    const newSelected = new Set(selectedContacts);
    if (checked) {
      newSelected.add(contactId);
    } else {
      newSelected.delete(contactId);
    }
    setSelectedContacts(newSelected);
  };

  const isAllSelected = contacts.length > 0 && selectedContacts.size === contacts.length;
  const isIndeterminate = selectedContacts.size > 0 && selectedContacts.size < contacts.length;

  useEffect(() => {
    let timeoutId = null;
    
    const handleScroll = () => {
      if (loading || !hasMore) return;
      
      const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
      const bottomDistance = scrollHeight - (scrollTop + clientHeight);
      
      if (bottomDistance <= 300) { // Trigger when 300px from bottom
        onLoadMore();
      }
    };

    const throttledHandleScroll = () => {
      if (timeoutId) return;
      timeoutId = setTimeout(() => {
        handleScroll();
        timeoutId = null;
      }, 200);
    };

    window.addEventListener('scroll', throttledHandleScroll);
    return () => {
      window.removeEventListener('scroll', throttledHandleScroll);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [hasMore, loading, onLoadMore]);
  
  // Clear selections when contacts change
  useEffect(() => {
    setSelectedContacts(prev => {
      const currentContactIds = new Set(contacts.map(c => c.id));
      const filteredSelection = new Set([...prev].filter(id => currentContactIds.has(id)));
      return filteredSelection;
    });
  }, [contacts]);
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800">Contacts</h2>
        <button
          onClick={onAddContact}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-semibold"
        >
          + Add Contact
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md p-4 mb-6 flex gap-4">
        <input
          type="text"
          placeholder="Search contacts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
        >
          <option value="" className="text-gray-500">All Statuses</option>
          <option value="None" className="text-gray-700">🔘 None</option>
          <option value="Called" className="text-blue-700">📞 Called</option>
          <option value="Not Attending" className="text-orange-700">⏸️ Not Attending</option>
          <option value="Follow-up" className="text-yellow-700">⏰ Follow-up</option>
          <option value="Interested" className="text-green-700">✅ Interested</option>
          <option value="Not Interested" className="text-red-700">❌ Not Interested</option>
          <option value="Irrelevant" className="text-purple-700">🚫 Irrelevant</option>
          <option value="Logged In" className="text-teal-700">🎯 Logged In</option>
        </select>
      </div>

      {/* Bulk Actions Bar */}
      {selectedContacts.size > 0 && (
        <div className="bg-indigo-50 border-l-4 border-indigo-400 p-4 mb-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-indigo-800 font-medium">
                {selectedContacts.size} contact{selectedContacts.size !== 1 ? 's' : ''} selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <select
                onChange={async (e) => {
                  if (e.target.value) {
                    const newStatus = e.target.value;
                    const contactIds = Array.from(selectedContacts);
                    
                    // Update all selected contacts immediately
                    for (const contactId of contactIds) {
                      const contact = contacts.find(c => c.id === contactId);
                      if (contact) {
                        await onUpdateStatus(contactId, newStatus);
                      }
                    }
                    
                    e.target.value = '';
                    setSelectedContacts(new Set()); // Clear selection after update
                  }
                }}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="" className="text-gray-500">Update Status</option>
                <option value="None" className="text-gray-700">🔘 None</option>
                <option value="Called" className="text-blue-700">📞 Called</option>
                <option value="Not Attending" className="text-orange-700">⏸️ Not Attending</option>
                <option value="Follow-up" className="text-yellow-700">⏰ Follow-up</option>
                <option value="Interested" className="text-green-700">✅ Interested</option>
                <option value="Not Interested" className="text-red-700">❌ Not Interested</option>
                <option value="Irrelevant" className="text-purple-700">🚫 Irrelevant</option>
                <option value="Logged In" className="text-teal-700">🎯 Logged In</option>
              </select>
              <button
                onClick={async () => {
                  const contactIds = Array.from(selectedContacts);
                  const success = await onBulkDeleteContacts(contactIds);
                  if (success) {
                    setSelectedContacts(new Set());
                  }
                }}
                className="px-3 py-1 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition"
              >
                Delete Selected
              </button>
              <button
                onClick={() => setSelectedContacts(new Set())}
                className="px-3 py-1 bg-gray-500 text-white text-sm rounded-md hover:bg-gray-600 transition"
              >
                Clear Selection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contacts Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-max">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left whitespace-nowrap min-w-[50px]">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isIndeterminate;
                    }}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap min-w-[120px]">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap min-w-[150px]">Shop Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap min-w-[200px]">Address</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap min-w-[100px]">City</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap min-w-[80px]">State</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap min-w-[120px]">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap min-w-[150px]">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap min-w-[100px]">Actions</th>
              </tr>
            </thead>
          <tbody className="divide-y divide-gray-200">
            {contacts.map(contact => (
              <tr 
                key={contact.id} 
                className={`hover:bg-gray-50 cursor-pointer ${selectedContacts.has(contact.id) ? 'bg-indigo-50' : ''}`}
                onClick={() => onSelectContact(contact)}
              >
                <td className="px-6 py-4 whitespace-nowrap min-w-[50px]">
                  <input
                    type="checkbox"
                    checked={selectedContacts.has(contact.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleSelectContact(contact.id, e.target.checked);
                    }}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap min-w-[120px]">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-900">{contact.phone}</span>
                    <a
                      href={`tel:${contact.phone}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onLogCall(contact.id);
                      }}
                      className="text-indigo-600 hover:text-indigo-800"
                      title="Call"
                    >
                      📞
                    </a>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-700 min-w-[150px]">
                  <div className="flex items-center justify-between">
                    <span>{contact.data.shop_name || contact.data.Shop_Name || contact.data['Shop Name'] || '-'}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const newShopName = prompt('Enter new shop name:', contact.data.shop_name || contact.data.Shop_Name || contact.data['Shop Name'] || '');
                        if (newShopName !== null && newShopName !== (contact.data.shop_name || contact.data.Shop_Name || contact.data['Shop Name'] || '')) {
                          onUpdate({
                            ...contact,
                            data: {
                              ...contact.data,
                              shop_name: newShopName
                            }
                          });
                        }
                      }}
                      className="text-indigo-600 hover:text-indigo-800 text-sm ml-2"
                      title="Edit Shop Name"
                    >
                      ✏️
                    </button>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-700 min-w-[200px]">
                  {contact.data.address || contact.data.Address || contact.data['Address'] || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-700 min-w-[100px]">
                  {contact.data.city || contact.data.City || contact.data['City'] || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-700 min-w-[80px]">
                  {contact.data.state || contact.data.State || contact.data['State'] || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap min-w-[120px]">
                  <div className="relative">
                    <select
                      value={contact.status}
                      onChange={(e) => {
                        e.stopPropagation();
                        onUpdateStatus(contact.id, e.target.value);
                      }}
                      className={`px-3 py-1 rounded-full text-sm border-0 font-medium focus:ring-2 focus:ring-indigo-500 ${
                        contact.status === 'None' ? 'bg-gray-100 text-gray-700' :
                        contact.status === 'Called' ? 'bg-blue-100 text-blue-800' :
                        contact.status === 'Not Attending' ? 'bg-orange-100 text-orange-800' :
                        contact.status === 'Follow-up' ? 'bg-yellow-100 text-yellow-800' :
                        contact.status === 'Interested' ? 'bg-green-100 text-green-800' :
                        contact.status === 'Not Interested' ? 'bg-red-100 text-red-800' :
                        contact.status === 'Irrelevant' ? 'bg-purple-100 text-purple-800' :
                        contact.status === 'Logged In' ? 'bg-teal-100 text-teal-800' :
                        'bg-gray-100 text-gray-700'
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {statuses.map(status => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-700 min-w-[150px]">
                  {contact.data.category || contact.data.Category || contact.data['Category'] || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm min-w-[100px]">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectContact(contact);
                    }}
                    className="text-indigo-600 hover:text-indigo-800 mr-3"
                  >
                    View
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteContact(contact.id);
                    }}
                    className="text-red-600 hover:text-red-800"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
        {contacts.length === 0 && !loading && (
          <div className="text-center py-12 text-gray-500">
            No contacts found. Import or add contacts to get started.
          </div>
        )}
      </div>
      
      {/* Load More Button - Fallback */}
      {hasMore && !loading && contacts.length > 0 && (
        <div className="text-center py-4">
          <button
            onClick={onLoadMore}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-semibold"
          >
            Load More Contacts
          </button>
        </div>
      )}
      
      {/* Loading indicator */}
      {loading && (
        <div className="text-center py-4">
          <div className="inline-flex items-center px-4 py-2 font-semibold leading-6 text-sm shadow rounded-md text-white bg-indigo-500">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Loading more contacts...
          </div>
        </div>
      )}
      
      {/* End of list indicator */}
      {!hasMore && contacts.length > 0 && (
        <div className="text-center py-4 text-gray-500">
          No more contacts to load
        </div>
      )}
    </div>
  );
};

// Follow-ups View
const FollowUpsView = ({ 
  followups, 
  onRefresh, 
  allFollowups, 
  onLoadMore, 
  hasMore, 
  loading, 
  onResetFollowups 
}) => {
  const [dateFilter, setDateFilter] = useState('all');
  const [filteredFollowups, setFilteredFollowups] = useState([]);
  const [localLoading, setLocalLoading] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (loading || !hasMore) return;
      
      const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
      if (scrollTop + clientHeight >= scrollHeight - 100) { // Trigger when 100px from bottom
        if (dateFilter !== 'all') {
          onLoadMore(dateFilter);
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hasMore, loading, onLoadMore, dateFilter]);

  const completeFollowUp = async (id) => {
    try {
      await axios.put(`${API}/followups/${id}/complete`);
      onRefresh();
      if (dateFilter !== 'all') {
        fetchFilteredFollowups();
      }
      
      // Also refresh dashboard follow-ups and activity logs for live updates
      if (window.refreshFollowups) {
        window.refreshFollowups();
      }
      if (window.refreshActivityLogs) {
        window.refreshActivityLogs();
      }
    } catch (error) {
      alert('Failed to complete follow-up');
    }
  };

  const fetchFilteredFollowups = async () => {
    if (dateFilter === 'all') {
      setFilteredFollowups([]);
    } else {
      setLocalLoading(true);
      onResetFollowups(dateFilter);
      setLocalLoading(false);
    }
  };

  useEffect(() => {
    if (dateFilter !== 'all') {
      fetchFilteredFollowups();
    }
  }, [dateFilter]);

  const displayFollowups = dateFilter === 'all' 
    ? [...followups.overdue, ...followups.upcoming] 
    : allFollowups;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800">Follow-ups Management</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setDateFilter('all')}
            className={`px-4 py-2 rounded-lg transition ${dateFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
          >
            All
          </button>
          <button
            onClick={() => setDateFilter('today')}
            className={`px-4 py-2 rounded-lg transition ${dateFilter === 'today' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
          >
            Today
          </button>
          <button
            onClick={() => setDateFilter('tomorrow')}
            className={`px-4 py-2 rounded-lg transition ${dateFilter === 'tomorrow' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
          >
            Tomorrow
          </button>
          <button
            onClick={() => setDateFilter('this_week')}
            className={`px-4 py-2 rounded-lg transition ${dateFilter === 'this_week' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
          >
            This Week
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-600">Loading follow-ups...</div>
      ) : (
        <>
          {dateFilter === 'all' && (
            <>
              {/* Overdue */}
              <div className="mb-8">
                <h3 className="text-xl font-bold text-red-600 mb-4">⚠️ Overdue ({followups.overdue.length})</h3>
                {followups.overdue.length === 0 ? (
                  <p className="text-gray-500">No overdue follow-ups</p>
                ) : (
                  <div className="grid gap-4">
                    {followups.overdue.map(followup => (
                      <div key={followup.id} className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-bold text-lg text-gray-800">{getContactName(followup)}</p>
                            <p className="text-sm text-gray-600 mt-1">📞 {getContactPhone(followup)}</p>
                            <p className="text-sm text-red-600 font-medium mt-1">⏰ Due: {format12Hour(followup.follow_up_date)}</p>
                            {followup.notes && <p className="text-sm text-gray-700 mt-2 italic">"{followup.notes}"</p>}
                          </div>
                          <button
                            onClick={() => completeFollowUp(followup.id)}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold"
                          >
                            ✓ Complete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Upcoming */}
              <div>
                <h3 className="text-xl font-bold text-indigo-600 mb-4">📅 Upcoming ({followups.upcoming.length})</h3>
                {followups.upcoming.length === 0 ? (
                  <p className="text-gray-500">No upcoming follow-ups</p>
                ) : (
                  <div className="grid gap-4">
                    {followups.upcoming.map(followup => (
                      <div key={followup.id} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-bold text-lg text-gray-800">{getContactName(followup)}</p>
                            <p className="text-sm text-gray-600 mt-1">📞 {getContactPhone(followup)}</p>
                            <p className="text-sm text-indigo-600 font-medium mt-1">⏰ Scheduled: {format12Hour(followup.follow_up_date)}</p>
                            {followup.notes && <p className="text-sm text-gray-700 mt-2 italic">"{followup.notes}"</p>}
                          </div>
                          <button
                            onClick={() => completeFollowUp(followup.id)}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold"
                          >
                            ✓ Complete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {dateFilter !== 'all' && (
            <div>
              <h3 className="text-xl font-bold text-indigo-600 mb-4">
                {dateFilter === 'today' && '📅 Today\'s Follow-ups'}
                {dateFilter === 'tomorrow' && '📅 Tomorrow\'s Follow-ups'}
                {dateFilter === 'this_week' && '📅 This Week\'s Follow-ups'}
                {' '}({displayFollowups.length})
              </h3>
              {displayFollowups.length === 0 && !loading && !localLoading ? (
                <p className="text-gray-500">No follow-ups found for this period</p>
              ) : (
                <div className="grid gap-4">
                  {displayFollowups.map(followup => {
                    const isOverdue = followup.status === 'overdue';
                    return (
                      <div key={followup.id} className={`${isOverdue ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'} border rounded-lg p-4`}>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-bold text-lg text-gray-800">{getContactName(followup)}</p>
                            <p className="text-sm text-gray-600 mt-1">📞 {getContactPhone(followup)}</p>
                            <p className={`text-sm font-medium mt-1 ${isOverdue ? 'text-red-600' : 'text-indigo-600'}`}>
                              ⏰ {isOverdue ? 'Overdue:' : 'Scheduled:'} {format12Hour(followup.follow_up_date)}
                            </p>
                            {followup.notes && <p className="text-sm text-gray-700 mt-2 italic">"{followup.notes}"</p>}
                          </div>
                          <button
                            onClick={() => completeFollowUp(followup.id)}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold"
                          >
                            ✓ Complete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {/* Loading indicator for filtered followups */}
              {dateFilter !== 'all' && loading && (
                <div className="text-center py-4">
                  <div className="inline-flex items-center px-4 py-2 font-semibold leading-6 text-sm shadow rounded-md text-white bg-indigo-500">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading more follow-ups...
                  </div>
                </div>
              )}
              
              {/* End of list indicator for filtered followups */}
              {dateFilter !== 'all' && !hasMore && displayFollowups.length > 0 && (
                <div className="text-center py-4 text-gray-500">
                  No more follow-ups to load
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// Import View
const ImportView = ({ onImportComplete }) => {
  const [file, setFile] = useState(null);
  const [columns, setColumns] = useState([]);
  const [mapping, setMapping] = useState({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setResult(null);

    // Preview file to get columns
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await axios.post(`${API}/contacts/preview`, formData);
      setColumns(response.data.columns);
    } catch (error) {
      alert('Failed to preview file');
    }
  };

  const handleImport = async () => {
    if (!file) {
      alert('Please select a file');
      return;
    }

    setImporting(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('column_mapping', JSON.stringify(mapping));

    try {
      const response = await axios.post(`${API}/contacts/import`, formData);
      setResult(response.data);
      onImportComplete();
    } catch (error) {
      alert('Import failed: ' + (error.response?.data?.detail || error.message));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-800 mb-6">Import Contacts from Excel</h2>

      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Upload Excel File (.xlsx)
          </label>
          <input
            type="file"
            accept=".xlsx"
            onChange={handleFileSelect}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        {columns.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4">Map Excel Columns to CRM Fields</h3>
            <div className="grid gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Column (Optional)
                </label>
                <select
                  value={mapping.phone || ''}
                  onChange={(e) => setMapping({ ...mapping, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select column...</option>
                  {columns.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Shop Name Column</label>
                <select
                  value={mapping.shop_name || ''}
                  onChange={(e) => setMapping({ ...mapping, shop_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select column...</option>
                  {columns.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address Column</label>
                <select
                  value={mapping.address || ''}
                  onChange={(e) => setMapping({ ...mapping, address: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select column...</option>
                  {columns.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City Column</label>
                <select
                  value={mapping.city || ''}
                  onChange={(e) => setMapping({ ...mapping, city: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select column...</option>
                  {columns.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State Column</label>
                <select
                  value={mapping.state || ''}
                  onChange={(e) => setMapping({ ...mapping, state: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select column...</option>
                  {columns.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status Column</label>
                <select
                  value={mapping.status || ''}
                  onChange={(e) => setMapping({ ...mapping, status: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select column...</option>
                  {columns.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category Column</label>
                <select
                  value={mapping.category || ''}
                  onChange={(e) => setMapping({ ...mapping, category: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select column...</option>
                  {columns.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {columns.length > 0 && (
          <button
            onClick={handleImport}
            disabled={importing}
            className="w-full py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-semibold disabled:bg-gray-400"
          >
            {importing ? 'Importing...' : 'Import Contacts'}
          </button>
        )}

        {result && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h4 className="font-semibold text-green-800 mb-2">Import Complete!</h4>
            <p className="text-sm text-green-700">Imported: {result.imported} contacts</p>
            <p className="text-sm text-green-700">Skipped (duplicates): {result.skipped}</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Activity Log View
const ActivityLogView = ({ logs, onLoadMore, hasMore, loading, contacts = [] }) => {
  // Add infinite scroll functionality
  useEffect(() => {
    let timeoutId = null;
    
    const handleScroll = () => {
      if (loading || !hasMore) return;
      
      const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
      const bottomDistance = scrollHeight - (scrollTop + clientHeight);
      
      if (bottomDistance <= 300) { // Trigger when 300px from bottom
        onLoadMore();
      }
    };

    const throttledHandleScroll = () => {
      if (timeoutId) return;
      timeoutId = setTimeout(() => {
        handleScroll();
        timeoutId = null;
      }, 200);
    };

    window.addEventListener('scroll', throttledHandleScroll);
    return () => {
      window.removeEventListener('scroll', throttledHandleScroll);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [hasMore, loading, onLoadMore]);

  // Format date in Indian format (DD/MM/YYYY, HH:MM:SS AM/PM)
  const formatIndianDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  // Format action with better descriptions
  const formatAction = (log) => {
    switch (log.action) {
      case 'Updated contact':
        if (log.details && log.details.includes('status')) {
          return '📝 Status Updated';
        }
        return '✏️ Contact Updated';
      case 'Created contact':
        return '➕ Contact Created';
      case 'Deleted contact':
        return '🗑️ Contact Deleted';
      case 'Created follow-up':
        return '📅 Follow-up Scheduled';
      case 'Completed follow-up':
        return '✅ Follow-up Completed';
      case 'Logged call':
        return '📞 Call Logged';
      case 'Added note':
        return '📝 Note Added';
      case 'Imported contacts':
        return '📤 Contacts Imported';
      default:
        return log.action;
    }
  };

  // Helper function to get contact from log (reused by both shop name and phone functions)
  const getContactFromLog = (log) => {
    if (!log.target || !contacts.length) return null;
    
    // If target is a phone number, find contact directly
    if (log.target.startsWith('+91') || /^\+?\d+/.test(log.target)) {
      return contacts.find(c => c.phone === log.target);
    }
    
    // If target looks like a contact ID (UUID), find contact by various ID fields
    if (log.target.length === 36 && log.target.includes('-')) {
      return contacts.find(c => c.id === log.target) || 
             contacts.find(c => c.contact_id === log.target) ||
             contacts.find(c => c._id === log.target);
    }
    
    return null;
  };

  // Helper function to get shop name from log
  const getShopNameFromLog = (log) => {
    const contact = getContactFromLog(log);
    if (contact && contact.data) {
      const shopName = contact.data.shop_name || contact.data.Shop_Name || contact.data['Shop Name'];
      return shopName || 'No Shop Name';
    }
    return 'N/A';
  };

  // Format target with better context
  const formatTarget = (log) => {
    if (log.target) {
      // If target looks like a phone number, format it nicely
      if (log.target.startsWith('+91') || /^\+?\d+/.test(log.target)) {
        return `📱 ${log.target}`;
      }
      // If target looks like a contact ID (UUID), find and show phone number
      if (log.target.length === 36 && log.target.includes('-')) {
        const contact = getContactFromLog(log);
        if (contact && contact.phone) {
          return `📱 ${contact.phone}`;
        }
        
        // For follow-up completed actions, show appropriate message
        if (log.action === 'Completed follow-up') {
          return '✅ Follow-up Task';
        }
        return `📋 Follow-up`;
      }
      return log.target;
    }
    return 'N/A';
  };

  // Format details with more context
  const formatDetails = (log) => {
    if (!log.details || log.details === 'N/A') {
      // For follow-up completions, try to show more context
      if (log.action === 'Completed follow-up' && log.target) {
        return 'Follow-up task completed successfully';
      }
      return 'N/A';
    }

    // Parse status updates to show old -> new status
    if (log.action === 'Updated contact' && log.details.includes('status')) {
      return '📊 Contact status changed';
    }

    // Format follow-up scheduling details
    if (log.action === 'Created follow-up' && log.details.includes('Scheduled for')) {
      const scheduledTime = log.details.match(/Scheduled for (.+)/)?.[1];
      if (scheduledTime) {
        const date = new Date(scheduledTime);
        return `⏰ Scheduled for ${formatIndianDate(date)}`;
      }
    }

    return log.details;
  };

  // Get row styling based on action type
  const getRowStyling = (action) => {
    switch (action) {
      case 'Created contact':
      case 'Created follow-up':
        return 'bg-green-50 hover:bg-green-100 border-l-4 border-green-400';
      case 'Updated contact':
        return 'bg-blue-50 hover:bg-blue-100 border-l-4 border-blue-400';
      case 'Deleted contact':
        return 'bg-red-50 hover:bg-red-100 border-l-4 border-red-400';
      case 'Completed follow-up':
        return 'bg-purple-50 hover:bg-purple-100 border-l-4 border-purple-400';
      case 'Logged call':
        return 'bg-yellow-50 hover:bg-yellow-100 border-l-4 border-yellow-400';
      default:
        return 'hover:bg-gray-50';
    }
  };

  useEffect(() => {
    let timeoutId = null;
    
    const handleScroll = () => {
      if (loading || !hasMore) return;
      
      const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
      const bottomDistance = scrollHeight - (scrollTop + clientHeight);
      
      if (bottomDistance <= 300) { // Trigger when 300px from bottom
        onLoadMore();
      }
    };

    const throttledHandleScroll = () => {
      if (timeoutId) return;
      timeoutId = setTimeout(() => {
        handleScroll();
        timeoutId = null;
      }, 200);
    };

    window.addEventListener('scroll', throttledHandleScroll);
    return () => {
      window.removeEventListener('scroll', throttledHandleScroll);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [hasMore, loading, onLoadMore]);

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-800 mb-6">Activity Log</h2>
      
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {logs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg">No activity logs yet</p>
            <p className="text-sm mt-2">Actions like creating contacts, updating statuses, and scheduling follow-ups will appear here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date & Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shop Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact/Target</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {logs.map(log => (
                  <tr key={log.id} className={getRowStyling(log.action)}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">
                      {formatIndianDate(log.timestamp)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-indigo-500 rounded-full mr-2"></div>
                        {log.user_email.split('@')[0]}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">
                      {formatAction(log)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {getShopNameFromLog(log)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {formatTarget(log)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Load More Button - Fallback */}
        {hasMore && !loading && logs.length > 0 && (
          <div className="text-center py-4">
            <button
              onClick={onLoadMore}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-semibold"
            >
              Load More Activity Logs
            </button>
          </div>
        )}
        
        {/* Loading indicator */}
        {loading && (
          <div className="text-center py-4">
            <div className="inline-flex items-center px-4 py-2 font-semibold leading-6 text-sm shadow rounded-md text-white bg-indigo-500">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Loading more activity logs...
            </div>
          </div>
        )}
        
        {/* End of list indicator */}
        {!hasMore && logs.length > 0 && (
          <div className="text-center py-4 text-gray-500">
            No more activity logs to load
          </div>
        )}
      </div>
    </div>
  );
};

// Contact Detail Modal
const ContactDetailModal = ({ contact, onClose, onUpdate, onDelete, onLogCall, onUpdateStatus, onFollowupCreated }) => {
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpNotes, setFollowUpNotes] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editedContact, setEditedContact] = useState({
    phone: contact.phone,
    shop_name: contact.data.shop_name || contact.data.Shop_Name || contact.data['Shop Name'] || '',
    address: contact.data.address || contact.data.Address || contact.data['Address'] || '',
    city: contact.data.city || contact.data.City || contact.data['City'] || '',
    state: contact.data.state || contact.data.State || contact.data['State'] || '',
    category: contact.data.category || contact.data.Category || contact.data['Category'] || ''
  });

  useEffect(() => {
    fetchNotes();
  }, [contact.id]);

  const fetchNotes = async () => {
    try {
      const response = await axios.get(`${API}/notes/contact/${contact.id}`);
      setNotes(response.data);
    } catch (error) {
      console.error('Failed to fetch notes:', error);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    try {
      // Optimistically add the note to the list immediately
      const tempNote = {
        id: Date.now(), // Temporary ID
        content: newNote,
        created_at: new Date().toISOString()
      };
      
      setNotes(prevNotes => [tempNote, ...prevNotes]);
      setNewNote('');
      
      // Make API call
      const response = await axios.post(`${API}/notes`, {
        contact_id: contact.id,
        content: tempNote.content
      });
      
      // Replace temp note with real note from server
      setNotes(prevNotes => 
        prevNotes.map(note => 
          note.id === tempNote.id ? response.data : note
        )
      );
      
      // Refresh activity logs for live updates
      if (window.refreshActivityLogs) {
        window.refreshActivityLogs();
      }
    } catch (error) {
      alert('Failed to add note');
      // Remove the optimistic note on error
      setNotes(prevNotes => prevNotes.filter(note => note.id !== tempNote.id));
    }
  };

  const handleCreateFollowUp = async () => {
    if (!followUpDate) {
      alert('Please select a follow-up date');
      return;
    }

    try {
      await axios.post(`${API}/followups`, {
        contact_id: contact.id,
        follow_up_date: new Date(followUpDate).toISOString(),
        notes: followUpNotes
      });
      alert('Follow-up created successfully!');
      setFollowUpDate('');
      setFollowUpNotes('');
      
      // Refresh follow-ups data immediately
      if (onFollowupCreated) {
        onFollowupCreated();
      }
      
      // Refresh activity logs for live updates
      if (window.refreshActivityLogs) {
        window.refreshActivityLogs();
      }
    } catch (error) {
      alert('Failed to create follow-up');
    }
  };

  const handleSaveEdit = async () => {
    try {
      const updates = {
        phone: editedContact.phone,
        data: {
          shop_name: editedContact.shop_name || undefined,
          address: editedContact.address || undefined,
          city: editedContact.city || undefined,
          state: editedContact.state || undefined,
          category: editedContact.category || undefined
        }
      };
      
      await onUpdate(updates);
      setIsEditing(false);
      alert('Contact updated successfully!');
    } catch (error) {
      alert('Failed to update contact');
    }
  };

  const handleCancelEdit = () => {
    setEditedContact({
      phone: contact.phone,
      shop_name: contact.data.shop_name || contact.data.Shop_Name || contact.data['Shop Name'] || '',
      address: contact.data.address || contact.data.Address || contact.data['Address'] || '',
      city: contact.data.city || contact.data.City || contact.data['City'] || '',
      state: contact.data.state || contact.data.State || contact.data['State'] || '',
      category: contact.data.category || contact.data.Category || contact.data['Category'] || ''
    });
    setIsEditing(false);
  };

  const statuses = ['None', 'Called', 'Not Attending', 'Follow-up', 'Interested', 'Not Interested', 'Irrelevant', 'Logged In'];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">Contact Details</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
        </div>

        <div className="p-6 space-y-6">
          {/* Contact Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Contact Information</h3>
              <div className="flex gap-2">
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-3 py-1 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 transition"
                  >
                    ✏️ Edit
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleSaveEdit}
                      className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition"
                    >
                      ✅ Save
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="px-3 py-1 bg-gray-500 text-white text-sm rounded-md hover:bg-gray-600 transition"
                    >
                      ✖️ Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-600">Phone</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedContact.phone}
                    onChange={(e) => setEditedContact({ ...editedContact, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg mt-1 font-medium"
                    placeholder="Phone number"
                  />
                ) : (
                  <p className="font-medium">{contact.phone}</p>
                )}
              </div>
              <div>
                <label className="text-sm text-gray-600">Shop Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedContact.shop_name}
                    onChange={(e) => setEditedContact({ ...editedContact, shop_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg mt-1 font-medium"
                    placeholder="Shop name"
                  />
                ) : (
                  <p className="font-medium">{contact.data.shop_name || contact.data.Shop_Name || contact.data['Shop Name'] || '-'}</p>
                )}
              </div>
              <div>
                <label className="text-sm text-gray-600">Address</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedContact.address}
                    onChange={(e) => setEditedContact({ ...editedContact, address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg mt-1 font-medium"
                    placeholder="Address"
                  />
                ) : (
                  <p className="font-medium">{contact.data.address || contact.data.Address || contact.data['Address'] || '-'}</p>
                )}
              </div>
              <div>
                <label className="text-sm text-gray-600">City</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedContact.city}
                    onChange={(e) => setEditedContact({ ...editedContact, city: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg mt-1 font-medium"
                    placeholder="City"
                  />
                ) : (
                  <p className="font-medium">{contact.data.city || contact.data.City || contact.data['City'] || '-'}</p>
                )}
              </div>
              <div>
                <label className="text-sm text-gray-600">State</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedContact.state}
                    onChange={(e) => setEditedContact({ ...editedContact, state: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg mt-1 font-medium"
                    placeholder="State"
                  />
                ) : (
                  <p className="font-medium">{contact.data.state || contact.data.State || contact.data['State'] || '-'}</p>
                )}
              </div>
              <div>
                <label className="text-sm text-gray-600">Category</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedContact.category}
                    onChange={(e) => setEditedContact({ ...editedContact, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg mt-1 font-medium"
                    placeholder="Category"
                  />
                ) : (
                  <p className="font-medium">{contact.data.category || contact.data.Category || contact.data['Category'] || '-'}</p>
                )}
              </div>
              <div>
                <label className="text-sm text-gray-600">Status</label>
                <select
                  value={contact.status}
                  onChange={(e) => onUpdateStatus(e.target.value)}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg mt-1 font-medium ${
                    contact.status === 'None' ? 'bg-gray-50 text-gray-700' :
                    contact.status === 'Called' ? 'bg-blue-50 text-blue-800' :
                    contact.status === 'Not Attending' ? 'bg-orange-50 text-orange-800' :
                    contact.status === 'Follow-up' ? 'bg-yellow-50 text-yellow-800' :
                    contact.status === 'Interested' ? 'bg-green-50 text-green-800' :
                    contact.status === 'Not Interested' ? 'bg-red-50 text-red-800' :
                    contact.status === 'Irrelevant' ? 'bg-purple-50 text-purple-800' :
                    contact.status === 'Logged In' ? 'bg-teal-50 text-teal-800' :
                    'bg-gray-50 text-gray-700'
                  }`}
                >
                  <option value="None" className="text-gray-700">🔘 None - No action taken</option>
                  <option value="Called" className="text-blue-700">📞 Called - Contact established</option>
                  <option value="Not Attending" className="text-orange-700">⏸️ Not Attending - Unavailable/Busy</option>
                  <option value="Follow-up" className="text-yellow-700">⏰ Follow-up - Needs reconnection</option>
                  <option value="Interested" className="text-green-700">✅ Interested - Positive response</option>
                  <option value="Not Interested" className="text-red-700">❌ Not Interested - Declined</option>
                  <option value="Irrelevant" className="text-purple-700">🚫 Irrelevant - Wrong target</option>
                  <option value="Logged In" className="text-teal-700">🎯 Logged In - Purchased & Active</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-600">Last Call</label>
                <p className="font-medium">{contact.last_call_at ? format12Hour(contact.last_call_at) : 'Never'}</p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <a
                href={`tel:${contact.phone}`}
                onClick={() => onLogCall()}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                📞 Call Now
              </a>
              <button
                onClick={onDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete Contact
              </button>
            </div>
          </div>

          {/* Notes Section */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Notes & Feedback</h3>
            <div className="space-y-2 mb-3">
              {notes.map(note => (
                <div key={note.id} className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-700">{note.content}</p>
                  <p className="text-xs text-gray-500 mt-1">{format12Hour(note.created_at)}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a note..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
              />
              <button
                onClick={handleAddNote}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Add
              </button>
            </div>
          </div>

          {/* Follow-up Section */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Schedule Follow-up</h3>
            <div className="space-y-3">
              <input
                type="datetime-local"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
              <textarea
                value={followUpNotes}
                onChange={(e) => setFollowUpNotes(e.target.value)}
                placeholder="Follow-up notes (optional)"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                rows="3"
              />
              <button
                onClick={handleCreateFollowUp}
                className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Create Follow-up
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Contact Form Modal
const ContactFormModal = ({ onClose, onSave }) => {
  const [phone, setPhone] = useState('');
  const [shopName, setShopName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [category, setCategory] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      phone,
      data: {
        shop_name: shopName || undefined,
        address: address || undefined,
        city: city || undefined,
        state: state || undefined,
        category: category || undefined
      }
    };
    onSave(data);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div className="border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">Add New Contact</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              placeholder="+1234567890"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Shop Name</label>
            <input
              type="text"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              placeholder="Shop Name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              placeholder="Street Address"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                placeholder="City"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                placeholder="State"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              placeholder="Business Category"
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold"
          >
            Add Contact
          </button>
        </form>
      </div>
    </div>
  );
};

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl text-gray-600">Loading...</div>
      </div>
    );
  }

  return user ? <Dashboard /> : <AuthPage />;
}

function AppWrapper() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}

export default AppWrapper;