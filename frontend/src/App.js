import React, { useState, useEffect, createContext, useContext } from 'react';
import axios from 'axios';
import '@/App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

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

  useEffect(() => {
    fetchStats();
    fetchContacts();
    fetchFollowups();
    fetchActivityLogs();
    
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    
    // Check for follow-ups every minute
    const interval = setInterval(checkFollowupAlerts, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/contacts/count`);
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchContacts = async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter) params.append('status', statusFilter);
      
      const response = await axios.get(`${API}/contacts?${params}`);
      setContacts(response.data);
    } catch (error) {
      console.error('Failed to fetch contacts:', error);
    }
  };

  const fetchFollowups = async () => {
    try {
      const response = await axios.get(`${API}/followups/upcoming`);
      setFollowups(response.data);
    } catch (error) {
      console.error('Failed to fetch follow-ups:', error);
    }
  };

  const fetchActivityLogs = async () => {
    try {
      const response = await axios.get(`${API}/activity-logs?limit=50`);
      setActivityLogs(response.data);
    } catch (error) {
      console.error('Failed to fetch activity logs:', error);
    }
  };

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
      fetchActivityLogs();
    } catch (error) {
      alert('Failed to log call');
    }
  };

  const handleDeleteContact = async (contactId) => {
    if (!window.confirm('Are you sure you want to delete this contact?')) return;
    
    try {
      await axios.delete(`${API}/contacts/${contactId}`);
      fetchContacts();
      fetchStats();
      setSelectedContact(null);
    } catch (error) {
      alert('Failed to delete contact');
    }
  };

  const handleUpdateStatus = async (contactId, status) => {
    try {
      await axios.put(`${API}/contacts/${contactId}`, { status });
      fetchContacts();
      fetchStats();
      if (selectedContact && selectedContact.id === contactId) {
        setSelectedContact({ ...selectedContact, status });
      }
    } catch (error) {
      alert('Failed to update status');
    }
  };

  useEffect(() => {
    if (view === 'contacts') {
      fetchContacts();
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
            />
          )}
          {view === 'followups' && (
            <FollowUpsView
              followups={followups}
              onRefresh={fetchFollowups}
            />
          )}
          {view === 'import' && (
            <ImportView onImportComplete={() => { fetchContacts(); fetchStats(); }} />
          )}
          {view === 'activity' && <ActivityLogView logs={activityLogs} />}
        </div>
      </div>

      {/* Contact Detail Modal */}
      {selectedContact && (
        <ContactDetailModal
          contact={selectedContact}
          onClose={() => setSelectedContact(null)}
          onUpdate={(updates) => {
            axios.put(`${API}/contacts/${selectedContact.id}`, updates).then(() => {
              fetchContacts();
              setSelectedContact(null);
            });
          }}
          onDelete={() => handleDeleteContact(selectedContact.id)}
          onLogCall={() => handleLogCall(selectedContact.id)}
          onUpdateStatus={(status) => handleUpdateStatus(selectedContact.id, status)}
        />
      )}

      {/* Contact Create/Edit Modal */}
      {showContactModal && (
        <ContactFormModal
          onClose={() => setShowContactModal(false)}
          onSave={async (data) => {
            await axios.post(`${API}/contacts`, data);
            fetchContacts();
            fetchStats();
            setShowContactModal(false);
          }}
        />
      )}
    </div>
  );
};

// Dashboard View
const DashboardView = ({ stats, followups }) => {
  const statuses = ['Connected', 'Not Attending', 'Follow-up', 'Interested', 'Not Interested'];
  
  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-800 mb-6">Dashboard</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-indigo-500">
          <h3 className="text-gray-600 text-sm font-medium mb-2">Total Contacts</h3>
          <p className="text-4xl font-bold text-gray-800">{stats.total}</p>
        </div>
        
        {statuses.map(status => (
          <div key={status} className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-gray-600 text-sm font-medium mb-2">{status}</h3>
            <p className="text-3xl font-bold text-gray-800">{stats.by_status[status] || 0}</p>
          </div>
        ))}
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
                  <p className="font-medium text-gray-800">Contact: {followup.contact_id}</p>
                  <p className="text-sm text-gray-600">Due: {new Date(followup.follow_up_date).toLocaleString()}</p>
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
                  <p className="font-medium text-gray-800">Contact: {followup.contact_id}</p>
                  <p className="text-sm text-gray-600">Due: {new Date(followup.follow_up_date).toLocaleString()}</p>
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
  onDeleteContact
}) => {
  const statuses = ['Connected', 'Not Attending', 'Follow-up', 'Interested', 'Not Interested'];
  
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
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Statuses</option>
          {statuses.map(status => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
      </div>

      {/* Contacts Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Call</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {contacts.map(contact => (
              <tr key={contact.id} className="hover:bg-gray-50 cursor-pointer">
                <td className="px-6 py-4 whitespace-nowrap">
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
                <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                  {contact.data.name || contact.data.Name || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <select
                    value={contact.status}
                    onChange={(e) => {
                      e.stopPropagation();
                      onUpdateStatus(contact.id, e.target.value);
                    }}
                    className="px-3 py-1 rounded-full text-sm border border-gray-300"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {statuses.map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {contact.last_call_at ? new Date(contact.last_call_at).toLocaleString() : 'Never'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
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
        {contacts.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No contacts found. Import or add contacts to get started.
          </div>
        )}
      </div>
    </div>
  );
};

// Follow-ups View
const FollowUpsView = ({ followups, onRefresh }) => {
  const [dateFilter, setDateFilter] = useState('all');
  const [filteredFollowups, setFilteredFollowups] = useState([]);
  const [loading, setLoading] = useState(false);

  const completeFollowUp = async (id) => {
    try {
      await axios.put(`${API}/followups/${id}/complete`);
      onRefresh();
      if (dateFilter !== 'all') {
        fetchFilteredFollowups();
      }
    } catch (error) {
      alert('Failed to complete follow-up');
    }
  };

  const fetchFilteredFollowups = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/followups/by-date?date_filter=${dateFilter}`);
      setFilteredFollowups(response.data.followups || []);
    } catch (error) {
      console.error('Failed to fetch filtered follow-ups:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (dateFilter !== 'all') {
      fetchFilteredFollowups();
    }
  }, [dateFilter]);

  const displayFollowups = dateFilter === 'all' 
    ? [...followups.overdue, ...followups.upcoming] 
    : filteredFollowups;

  const getContactName = (followup) => {
    if (followup.contact) {
      return followup.contact.data?.name || followup.contact.data?.Name || followup.contact.phone;
    }
    return followup.contact_id;
  };

  const getContactPhone = (followup) => {
    return followup.contact?.phone || 'N/A';
  };

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
                            <p className="text-sm text-red-600 font-medium mt-1">⏰ Due: {new Date(followup.follow_up_date).toLocaleString()}</p>
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
                            <p className="text-sm text-indigo-600 font-medium mt-1">⏰ Scheduled: {new Date(followup.follow_up_date).toLocaleString()}</p>
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
                {' '}({filteredFollowups.length})
              </h3>
              {filteredFollowups.length === 0 ? (
                <p className="text-gray-500">No follow-ups found for this period</p>
              ) : (
                <div className="grid gap-4">
                  {filteredFollowups.map(followup => {
                    const isOverdue = followup.status === 'overdue';
                    return (
                      <div key={followup.id} className={`${isOverdue ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'} border rounded-lg p-4`}>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-bold text-lg text-gray-800">{getContactName(followup)}</p>
                            <p className="text-sm text-gray-600 mt-1">📞 {getContactPhone(followup)}</p>
                            <p className={`text-sm font-medium mt-1 ${isOverdue ? 'text-red-600' : 'text-indigo-600'}`}>
                              ⏰ {isOverdue ? 'Overdue:' : 'Scheduled:'} {new Date(followup.follow_up_date).toLocaleString()}
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
    if (!file || !mapping.phone) {
      alert('Please select a file and map the phone column');
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
                  Phone Column (Required) *
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Name Column</label>
                <select
                  value={mapping.name || ''}
                  onChange={(e) => setMapping({ ...mapping, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select column...</option>
                  {columns.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Column</label>
                <select
                  value={mapping.email || ''}
                  onChange={(e) => setMapping({ ...mapping, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select column...</option>
                  {columns.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Column</label>
                <select
                  value={mapping.company || ''}
                  onChange={(e) => setMapping({ ...mapping, company: e.target.value })}
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
            disabled={importing || !mapping.phone}
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
const ActivityLogView = ({ logs }) => {
  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-800 mb-6">Activity Log</h2>
      
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Target</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {logs.map(log => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {new Date(log.timestamp).toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                  {log.user_email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">
                  {log.action}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {log.target || 'N/A'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {log.details || 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Contact Detail Modal
const ContactDetailModal = ({ contact, onClose, onUpdate, onDelete, onLogCall, onUpdateStatus }) => {
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpNotes, setFollowUpNotes] = useState('');

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
      await axios.post(`${API}/notes`, {
        contact_id: contact.id,
        content: newNote
      });
      setNewNote('');
      fetchNotes();
    } catch (error) {
      alert('Failed to add note');
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
    } catch (error) {
      alert('Failed to create follow-up');
    }
  };

  const statuses = ['Connected', 'Not Attending', 'Follow-up', 'Interested', 'Not Interested'];

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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-600">Phone</label>
                <p className="font-medium">{contact.phone}</p>
              </div>
              <div>
                <label className="text-sm text-gray-600">Status</label>
                <select
                  value={contact.status}
                  onChange={(e) => onUpdateStatus(e.target.value)}
                  className="w-full px-3 py-1 border border-gray-300 rounded-lg mt-1"
                >
                  {statuses.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
              {Object.entries(contact.data).map(([key, value]) => (
                <div key={key}>
                  <label className="text-sm text-gray-600">{key}</label>
                  <p className="font-medium">{value}</p>
                </div>
              ))}
              <div>
                <label className="text-sm text-gray-600">Last Call</label>
                <p className="font-medium">{contact.last_call_at ? new Date(contact.last_call_at).toLocaleString() : 'Never'}</p>
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
                  <p className="text-xs text-gray-500 mt-1">{new Date(note.created_at).toLocaleString()}</p>
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
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      phone,
      data: {
        name: name || undefined,
        email: email || undefined,
        company: company || undefined
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
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