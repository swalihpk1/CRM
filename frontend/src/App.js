import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import axios from 'axios';
import './App.css';

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
      console.log('User data:', response.data); // Debug log
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
      await login(email, password);
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-indigo-600 mb-2">SmartCRM</h1>
          <p className="text-gray-600">Manage your contacts efficiently</p>
        </div>
        
        <div className="text-center mb-6">
          <h2 className="text-xl font-semibold text-gray-700">Login</h2>
          <p className="text-sm text-gray-500 mt-1">Please sign in to continue</p>
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
            Login
          </button>
        </form>
      </div>
    </div>
  );
};

// Main Dashboard Component
const Dashboard = () => {
  const { logout, user } = useAuth();
  const [view, setView] = useState('dashboard');
  const [contacts, setContacts] = useState([]);
  const [stats, setStats] = useState({ total: 0, by_status: {} });
  const [followups, setFollowups] = useState({ overdue: [], upcoming: [] });
  const [activityLogs, setActivityLogs] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [showGlobalMeetingModal, setShowGlobalMeetingModal] = useState(false);
  const [globalSelectedContacts, setGlobalSelectedContacts] = useState([]);
  const [globalMeetings, setGlobalMeetings] = useState([]);
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  const fetchMeetings = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/meetings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGlobalMeetings(response.data);
    } catch (error) {
      console.error('Failed to fetch meetings:', error);
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
    fetchMeetings();
    fetchPaginatedFollowups(0, 'all', true);
    fetchActivityLogs(0, true);
    
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    
    // Global function to schedule meeting from contact details
    window.scheduleMeetingFromContact = (contact) => {
      console.log('Schedule meeting clicked for contact:', contact);
      
      // Use global meeting modal that's always available
      setGlobalSelectedContacts([contact]);
      setShowGlobalMeetingModal(true);
    };
    
    // Check for follow-ups every minute
    const interval = setInterval(checkFollowupAlerts, 60000);
    return () => {
      clearInterval(interval);
      delete window.scheduleMeetingFromContact;
    };
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
  
  // Make fetchFollowups, resetActivityLogs and fetchMeetings available globally for live updates
  useEffect(() => {
    window.refreshFollowups = () => fetchFollowups();
    window.refreshActivityLogs = () => resetActivityLogs();
    window.refreshMeetings = () => fetchMeetings();
    return () => {
      delete window.refreshFollowups;
      delete window.refreshActivityLogs;
      delete window.refreshMeetings;
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

  const handleLogCall = async (contactId, phone) => {
    // Find the contact to get the phone number
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;
    
    // Set a timeout to show the confirmation after a short delay (giving time for the call to be initiated)
    setTimeout(async () => {
      if (window.confirm('Did you complete the call?')) {
        try {
          await axios.post(`${API}/contacts/${contactId}/call`);
          resetActivityLogs();
          // Also refresh global activity logs if available
          if (window.refreshActivityLogs) {
            window.refreshActivityLogs();
          }
        } catch (error) {
          alert('Failed to log call');
        }
      }
    }, 1000); // 1 second delay
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
      // Make API call first to get the updated contact with assigned_staff
      const response = await axios.put(`${API}/contacts/${contactId}`, { status });
      const updatedContact = response.data;
      
      // Update the contact in the list with all updated fields including assigned_staff
      setContacts(prevContacts => 
        prevContacts.map(contact => 
          contact.id === contactId ? updatedContact : contact
        )
      );
      
      // Update selected contact if it's the one being modified
      if (selectedContact && selectedContact.id === contactId) {
        setSelectedContact(updatedContact);
      }
      
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

  // Close mobile menu on large screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) { // lg breakpoint
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-indigo-700 text-white p-4 flex justify-between items-center z-50">
        <h1 className="text-xl font-bold">SmartCRM</h1>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 rounded-lg hover:bg-indigo-600 transition"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isMobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-50 w-64 bg-indigo-700 text-white flex flex-col transition-transform duration-300 ease-in-out`}>
        <div className="p-6 border-b border-indigo-600">
          <h1 className="text-2xl font-bold">SmartCRM</h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => {
              setView('dashboard');
              setIsMobileMenuOpen(false);
            }}
            className={`w-full text-left px-4 py-3 rounded-lg transition text-sm lg:text-base ${view === 'dashboard' ? 'bg-indigo-600' : 'hover:bg-indigo-600'}`}
          >
            📊 Dashboard
          </button>
          <button
            onClick={() => {
              setView('contacts');
              setIsMobileMenuOpen(false);
            }}
            className={`w-full text-left px-4 py-3 rounded-lg transition text-sm lg:text-base ${view === 'contacts' ? 'bg-indigo-600' : 'hover:bg-indigo-600'}`}
          >
            👥 Contacts
          </button>
          <button
            onClick={() => {
              setView('followups');
              setIsMobileMenuOpen(false);
            }}
            className={`w-full text-left px-4 py-3 rounded-lg transition text-sm lg:text-base ${view === 'followups' ? 'bg-indigo-600' : 'hover:bg-indigo-600'}`}
          >
            🔔 Follow-ups
          </button>
          <button
            onClick={() => {
              setView('meetings');
              setIsMobileMenuOpen(false);
            }}
            className={`w-full text-left px-4 py-3 rounded-lg transition text-sm lg:text-base ${view === 'meetings' ? 'bg-indigo-600' : 'hover:bg-indigo-600'}`}
          >
            📅 Meetings
          </button>
          {user?.role === 'admin' && (
            <button
              onClick={() => {
                setView('import');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full text-left px-4 py-3 rounded-lg transition text-sm lg:text-base ${view === 'import' ? 'bg-indigo-600' : 'hover:bg-indigo-600'}`}
            >
              📤 Import
            </button>
          )}
          <button
            onClick={() => {
              setView('demos');
              setIsMobileMenuOpen(false);
            }}
            className={`w-full text-left px-4 py-3 rounded-lg transition text-sm lg:text-base ${view === 'demos' ? 'bg-indigo-600' : 'hover:bg-indigo-600'}`}
          >
            🎬 Demo Reports
          </button>
          <button
            onClick={() => {
              setView('activity');
              setIsMobileMenuOpen(false);
            }}
            className={`w-full text-left px-4 py-3 rounded-lg transition text-sm lg:text-base ${view === 'activity' ? 'bg-indigo-600' : 'hover:bg-indigo-600'}`}
          >
            📝 Activity Log
          </button>
          {user?.role === 'admin' && (
            <>
              <button
                onClick={() => {
                  setView('productivity');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full text-left px-4 py-3 rounded-lg transition text-sm lg:text-base ${view === 'productivity' ? 'bg-indigo-600' : 'hover:bg-indigo-600'}`}
              >
                📊 Productivity
              </button>
              <button
                onClick={() => {
                  setView('users');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full text-left px-4 py-3 rounded-lg transition text-sm lg:text-base ${view === 'users' ? 'bg-indigo-600' : 'hover:bg-indigo-600'}`}
              >
                👤 Users
              </button>
            </>
          )}
        </nav>
        
        <div className="p-4 border-t border-indigo-600">
          <button
            onClick={logout}
            className="w-full px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg transition text-sm lg:text-base"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto lg:ml-0 pt-16 lg:pt-0 min-h-0">
        <div className="p-4 lg:p-8 min-h-full">
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
          {view === 'meetings' && (
            <MeetingsView 
              contacts={contacts}
              globalMeetings={globalMeetings}
            />
          )}
          {view === 'import' && user?.role === 'admin' && (
            <ImportView onImportComplete={() => { resetContacts(); fetchStats(); resetActivityLogs(); }} />
          )}
          {view === 'demos' && (
            <DemoReportsView />
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
          {view === 'productivity' && user?.role === 'admin' && (
            <ProductivityView />
          )}
          {view === 'users' && user?.role === 'admin' && (
            <UsersView />
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
      
      {/* Global Meeting Modal */}
      {showGlobalMeetingModal && (
        <GlobalMeetingModal
          contacts={contacts}
          selectedContacts={globalSelectedContacts}
          onClose={() => {
            setShowGlobalMeetingModal(false);
            setGlobalSelectedContacts([]);
          }}
          onSave={async (meetingData) => {
            try {
              const token = localStorage.getItem('token');
              
              // Save meeting to database
              const response = await axios.post(`${API}/meetings`, meetingData, {
                headers: { Authorization: `Bearer ${token}` }
              });
              
              // Refresh meetings list from database
              await fetchMeetings();
              
              // Refresh activity logs
              if (window.refreshActivityLogs) {
                window.refreshActivityLogs();
              }
              
              console.log('Meeting created:', response.data);
              alert('Meeting scheduled successfully!');
              setShowGlobalMeetingModal(false);
              setGlobalSelectedContacts([]);
            } catch (error) {
              console.error('Failed to schedule meeting:', error);
              alert('Failed to schedule meeting. Please try again.');
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
  const [selectedContact, setSelectedContact] = useState(null);
  const [showContactDetailModal, setShowContactDetailModal] = useState(false);
  
  const openContactDetailModal = (followup) => {
    if (followup.contact) {
      setSelectedContact(followup.contact);
      setShowContactDetailModal(true);
    }
  };
  
  return (
    <div>
      <h2 className="text-2xl lg:text-3xl font-bold text-gray-800 mb-4 lg:mb-6">Dashboard</h2>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6 mb-6 lg:mb-8">
        <div className="bg-white rounded-xl shadow-md p-4 lg:p-6 border-l-4 border-indigo-500">
          <h3 className="text-gray-600 text-xs lg:text-sm font-medium mb-2">Total Contacts</h3>
          <p className="text-2xl lg:text-4xl font-bold text-gray-800">{stats.total}</p>
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
            <div key={status} className={`${colors.bg} rounded-xl shadow-md p-4 lg:p-6 border-l-4 ${colors.border}`}>
              <h3 className={`${colors.text} text-xs lg:text-sm font-medium mb-2`}>{status}</h3>
              <p className={`text-2xl lg:text-3xl font-bold ${colors.count}`}>{stats.by_status[status] || 0}</p>
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
                <div 
                  key={followup.id} 
                  className="p-3 bg-red-50 rounded-lg border border-red-200 cursor-pointer"
                  onClick={() => openContactDetailModal(followup)}
                >
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                    <div className="flex-1">
                      <p className="font-medium text-gray-800 text-sm lg:text-base">{getContactName(followup)}</p>
                      <p className="text-xs lg:text-sm text-gray-600 mt-1">📞 {getContactPhone(followup)}</p>
                      <p className="text-xs lg:text-sm text-gray-600">Due: {format12Hour(followup.follow_up_date)}</p>
                      {followup.notes && <p className="text-xs lg:text-sm text-gray-500 mt-1">{followup.notes}</p>}
                    </div>
                    <div className="flex gap-2 sm:gap-1 sm:ml-2">
                      <a
                        href={`tel:${getContactPhone(followup)}`}
                        className="px-3 py-2 sm:px-2 sm:py-1 bg-green-600 text-white rounded-md hover:bg-green-700 text-xs font-semibold touch-manipulation"
                        title="Call Now"
                        onClick={(e) => e.stopPropagation()}
                      >
                        📞
                      </a>
                      <button
                        className="px-3 py-2 sm:px-2 sm:py-1 bg-orange-600 text-white rounded-md hover:bg-orange-700 text-xs font-semibold touch-manipulation"
                        title="Mark Demo Given"
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            // Check if demo already exists
                            const demoResponse = await axios.get(`${API}/contacts/${followup.contact_id}/demos`);
                            if (demoResponse.data.length > 0) {
                              alert('Demo already given to this shop!');
                              return;
                            }
                            
                            await axios.post(`${API}/demos`, {
                              contact_id: followup.contact_id
                            });
                            alert('Demo marked as given!');
                            // Refresh activity logs
                            if (window.refreshActivityLogs) {
                              window.refreshActivityLogs();
                            }
                          } catch (error) {
                            alert('Failed to mark demo as given');
                          }
                        }}
                      >
                        🎬
                      </button>
                    </div>
                  </div>
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
                <div 
                  key={followup.id} 
                  className="p-3 bg-blue-50 rounded-lg border border-blue-200 cursor-pointer"
                  onClick={() => openContactDetailModal(followup)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">{getContactName(followup)}</p>
                      <p className="text-sm text-gray-600 mt-1">📞 {getContactPhone(followup)}</p>
                      <p className="text-sm text-gray-600">Due: {format12Hour(followup.follow_up_date)}</p>
                      {followup.notes && <p className="text-sm text-gray-500 mt-1">{followup.notes}</p>}
                    </div>
                    <div className="flex gap-1 ml-2">
                      <a
                        href={`tel:${getContactPhone(followup)}`}
                        className="px-2 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 text-xs font-semibold"
                        title="Call Now"
                        onClick={(e) => e.stopPropagation()}
                      >
                        📞
                      </a>
                      <button
                        className="px-2 py-1 bg-orange-600 text-white rounded-md hover:bg-orange-700 text-xs font-semibold"
                        title="Mark Demo Given"
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            // Check if demo already exists
                            const demoResponse = await axios.get(`${API}/contacts/${followup.contact_id}/demos`);
                            if (demoResponse.data.length > 0) {
                              alert('Demo already given to this shop!');
                              return;
                            }
                            
                            await axios.post(`${API}/demos`, {
                              contact_id: followup.contact_id
                            });
                            alert('Demo marked as given!');
                            // Refresh activity logs
                            if (window.refreshActivityLogs) {
                              window.refreshActivityLogs();
                            }
                          } catch (error) {
                            alert('Failed to mark demo as given');
                          }
                        }}
                      >
                        🎬
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Contact Detail Modal - reused from contacts section */}
      {showContactDetailModal && selectedContact && (
        <ContactDetailModal
          contact={selectedContact}
          onClose={() => setShowContactDetailModal(false)}
          onUpdate={async (updates) => {
            try {
              await axios.put(`${API}/contacts/${selectedContact.id}`, updates);
              setSelectedContact({ ...selectedContact, ...updates });
              alert('Contact updated successfully!');
              // Refresh global data if available
              if (window.refreshFollowups) {
                window.refreshFollowups();
              }
            } catch (error) {
              alert('Failed to update contact');
              setShowContactDetailModal(false);
            }
          }}
          onDelete={async () => {
            if (!window.confirm('Are you sure you want to delete this contact?')) return;
            
            try {
              await axios.delete(`${API}/contacts/${selectedContact.id}`);
              setShowContactDetailModal(false);
              if (window.refreshFollowups) {
                window.refreshFollowups();
              }
              alert('Contact deleted successfully!');
            } catch (error) {
              alert('Failed to delete contact');
            }
          }}
          onLogCall={async () => {
            try {
              await axios.post(`${API}/contacts/${selectedContact.id}/call`);
              alert('Call logged successfully!');
              if (window.refreshActivityLogs) {
                window.refreshActivityLogs();
              }
            } catch (error) {
              alert('Failed to log call');
            }
          }}
          onUpdateStatus={async (status) => {
            try {
              await axios.put(`${API}/contacts/${selectedContact.id}`, { status });
              setSelectedContact({ ...selectedContact, status });
              if (window.refreshFollowups) {
                window.refreshFollowups();
              }
            } catch (error) {
              alert('Failed to update status');
            }
          }}
          onFollowupCreated={() => {
            if (window.refreshFollowups) {
              window.refreshFollowups();
            }
          }}
        />
      )}
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
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [draggedColumn, setDraggedColumn] = useState(null);
  
  // Default column configuration
  const defaultColumns = [
    { id: 'checkbox', label: 'Select', visible: true, width: 'min-w-[50px]', draggable: false },
    { id: 'phone', label: 'Phone', visible: true, width: 'min-w-[120px]', draggable: true },
    { id: 'phone2', label: 'Phone 2', visible: false, width: 'min-w-[120px]', draggable: true },
    { id: 'customerName', label: 'Customer Name', visible: true, width: 'min-w-[150px]', draggable: true },
    { id: 'shopName', label: 'Shop Name', visible: true, width: 'min-w-[150px]', draggable: true },
    { id: 'address', label: 'Address', visible: true, width: 'min-w-[200px]', draggable: true },
    { id: 'city', label: 'City', visible: true, width: 'min-w-[100px]', draggable: true },
    { id: 'state', label: 'State', visible: true, width: 'min-w-[80px]', draggable: true },
    { id: 'assignedStaff', label: 'Assigned Staff', visible: true, width: 'min-w-[150px]', draggable: true },
    { id: 'status', label: 'Status', visible: true, width: 'min-w-[120px]', draggable: true },
    { id: 'category', label: 'Category', visible: true, width: 'min-w-[150px]', draggable: true },
    { id: 'actions', label: 'Actions', visible: true, width: 'min-w-[100px]', draggable: false }
  ];
  
  // Load column configuration from localStorage
  const loadColumnConfig = () => {
    try {
      const saved = localStorage.getItem('contactTableColumns');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Ensure all default columns exist (for backward compatibility)
        const merged = defaultColumns.map(defaultCol => {
          const saved = parsed.find(col => col.id === defaultCol.id);
          return saved ? { ...defaultCol, ...saved } : defaultCol;
        });
        return merged;
      }
    } catch (error) {
      console.error('Error loading column config:', error);
    }
    return defaultColumns;
  };
  
  const [columns, setColumns] = useState(loadColumnConfig);
  
  // Save column configuration to localStorage
  const saveColumnConfig = (newColumns) => {
    try {
      localStorage.setItem('contactTableColumns', JSON.stringify(newColumns));
    } catch (error) {
      console.error('Error saving column config:', error);
    }
  };
  
  // Toggle column visibility
  const toggleColumnVisibility = (columnId) => {
    const newColumns = columns.map(col => 
      col.id === columnId ? { ...col, visible: !col.visible } : col
    );
    setColumns(newColumns);
    saveColumnConfig(newColumns);
  };
  
  // Handle column drag start
  const handleDragStart = (e, columnId) => {
    setDraggedColumn(columnId);
    e.dataTransfer.effectAllowed = 'move';
  };
  
  // Handle column drag over
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  
  // Handle column drop
  const handleDrop = (e, targetColumnId) => {
    e.preventDefault();
    if (!draggedColumn || draggedColumn === targetColumnId) return;
    
    const draggedIndex = columns.findIndex(col => col.id === draggedColumn);
    const targetIndex = columns.findIndex(col => col.id === targetColumnId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;
    
    const newColumns = [...columns];
    const [draggedItem] = newColumns.splice(draggedIndex, 1);
    newColumns.splice(targetIndex, 0, draggedItem);
    
    setColumns(newColumns);
    saveColumnConfig(newColumns);
    setDraggedColumn(null);
  };
  
  // Reset columns to default
  const resetColumns = () => {
    setColumns(defaultColumns);
    saveColumnConfig(defaultColumns);
  };
  
  // Get visible columns
  const visibleColumns = columns.filter(col => col.visible);

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
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4 lg:mb-6">
        <h2 className="text-2xl lg:text-3xl font-bold text-gray-800">Contacts</h2>
        <button
          onClick={onAddContact}
          className="px-4 lg:px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-semibold text-sm lg:text-base touch-manipulation"
        >
          + Add Contact
        </button>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-xl shadow-md p-4 mb-4 lg:mb-6 flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          placeholder="Search contacts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm lg:text-base"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white text-sm lg:text-base min-w-0 sm:min-w-[150px]"
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
      {/* Bulk Actions */}
      {selectedContacts.size > 0 && (
        <div className="bg-indigo-50 border-l-4 border-indigo-400 p-4 mb-4 rounded-lg">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center">
              <span className="text-indigo-800 font-medium text-sm lg:text-base">
                {selectedContacts.size} contact{selectedContacts.size !== 1 ? 's' : ''} selected
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
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
                className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 bg-white flex-1 sm:flex-none min-w-0"
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
        {/* Column Settings Button */}
        <div className="flex justify-end p-4 border-b">
          <button
            onClick={() => setShowColumnSettings(!showColumnSettings)}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition touch-manipulation"
          >
            ⚙️ <span className="hidden sm:inline">Column Settings</span>
          </button>
        </div>
        
        {/* Column Settings Panel */}
        {showColumnSettings && (
          <div className="p-4 border-b bg-gray-50">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
              <h3 className="text-sm font-medium text-gray-700">Customize Columns</h3>
              <button
                onClick={resetColumns}
                className="text-xs text-indigo-600 hover:text-indigo-800 self-start sm:self-auto"
              >
                Reset to Default
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {columns.filter(col => col.draggable !== false).map(column => (
                <label key={column.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={column.visible}
                    onChange={() => toggleColumnVisibility(column.id)}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <span className={column.visible ? 'text-gray-900' : 'text-gray-500'}>
                    {column.label}
                  </span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              💡 Tip: Drag column headers to reorder them
            </p>
          </div>
        )}
        
        <div className="overflow-x-auto">
          <table className="w-full min-w-max">
            <thead className="bg-gray-50 border-b">
              <tr className="text-xs lg:text-sm">
                {visibleColumns.map(column => {
                  if (column.id === 'checkbox') {
                    return (
                      <th key={column.id} className={`px-6 py-3 text-left whitespace-nowrap ${column.width}`}>
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
                    );
                  }
                  
                  return (
                    <th
                      key={column.id}
                      className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap ${column.width} ${
                        column.draggable ? 'cursor-move hover:bg-gray-100' : ''
                      } ${draggedColumn === column.id ? 'opacity-50' : ''}`}
                      draggable={column.draggable}
                      onDragStart={(e) => column.draggable && handleDragStart(e, column.id)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, column.id)}
                      title={column.draggable ? 'Drag to reorder columns' : ''}
                    >
                      <div className="flex items-center gap-1">
                        {column.draggable && <span className="text-gray-400">⋮⋮</span>}
                        {column.label}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
          <tbody className="divide-y divide-gray-200">
            {contacts.map(contact => (
              <tr 
                key={contact.id} 
                className={`hover:bg-gray-50 cursor-pointer ${selectedContacts.has(contact.id) ? 'bg-indigo-50' : ''}`}
                onClick={() => onSelectContact(contact)}
              >
                {visibleColumns.map(column => {
                  const getCellContent = () => {
                    switch (column.id) {
                      case 'checkbox':
                        return (
                          <input
                            type="checkbox"
                            checked={selectedContacts.has(contact.id)}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleSelectContact(contact.id, e.target.checked);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                          />
                        );
                      case 'phone':
                        return (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-900">{contact.phone}</span>
                            <a
                              href={`tel:${contact.phone}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onLogCall(contact.id, contact.phone);
                              }}
                              className="text-indigo-600 hover:text-indigo-800"
                              title="Call"
                            >
                              📞
                            </a>
                          </div>
                        );
                      case 'phone2':
                        const phone2 = contact.data.phone2 || contact.data.Phone2 || contact.data['Phone 2'] || contact.data.alternate_phone || contact.data.secondary_phone || '';
                        return (
                          <div className="flex items-center gap-2">
                            <div className="flex items-center justify-between w-full">
                              <span className="text-gray-900">{phone2 || '-'}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const newPhone2 = prompt('Enter phone 2:', phone2);
                                  if (newPhone2 !== null && newPhone2 !== phone2) {
                                    onUpdate({
                                      ...contact,
                                      data: {
                                        ...contact.data,
                                        phone2: newPhone2
                                      }
                                    });
                                  }
                                }}
                                className="text-indigo-600 hover:text-indigo-800 text-sm ml-2"
                                title="Edit Phone 2"
                              >
                                ✏️
                              </button>
                            </div>
                            {phone2 && (
                              <a
                                href={`tel:${phone2}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onLogCall(contact.id);
                                }}
                                className="text-indigo-600 hover:text-indigo-800"
                                title="Call Phone 2"
                              >
                                📞
                              </a>
                            )}
                          </div>
                        );
                      case 'customerName':
                        return (
                          <div className="flex items-center justify-between">
                            <span>{contact.customer_name || '-'}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const newCustomerName = prompt('Enter customer name:', contact.customer_name || '');
                                if (newCustomerName !== null && newCustomerName !== (contact.customer_name || '')) {
                                  onUpdate({
                                    ...contact,
                                    customer_name: newCustomerName
                                  });
                                }
                              }}
                              className="text-indigo-600 hover:text-indigo-800 text-sm ml-2"
                              title="Edit Customer Name"
                            >
                              ✏️
                            </button>
                          </div>
                        );
                      case 'shopName':
                        return (
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
                        );
                      case 'address':
                        return (
                          <span className="text-gray-700">
                            {contact.data.address || contact.data.Address || contact.data['Street Address'] || '-'}
                          </span>
                        );
                      case 'city':
                        return (
                          <span className="text-gray-700">
                            {contact.data.city || contact.data.City || '-'}
                          </span>
                        );
                      case 'state':
                        return (
                          <span className="text-gray-700">
                            {contact.data.state || contact.data.State || '-'}
                          </span>
                        );
                      case 'assignedStaff':
                        return (
                          <span className={`text-sm ${contact.assigned_staff ? 'text-indigo-600 font-medium' : 'text-gray-400'}`}>
                            {contact.assigned_staff || 'Unassigned'}
                          </span>
                        );
                      case 'status':
                        return (
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
                        );
                      case 'category':
                        return (
                          <span className="text-gray-700">
                            {contact.data.category || contact.data.Category || contact.data['Business Category'] || '-'}
                          </span>
                        );
                      case 'actions':
                        return (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.scheduleMeetingFromContact) {
                                  window.scheduleMeetingFromContact(contact);
                                } else {
                                  console.error('scheduleMeetingFromContact function not available');
                                }
                              }}
                              className="text-indigo-600 hover:text-indigo-800 text-sm"
                              title="Schedule Meeting"
                            >
                              📅
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectContact(contact);
                              }}
                              className="text-indigo-600 hover:text-indigo-800 text-sm"
                              title="View Details"
                            >
                              👁️
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`Are you sure you want to delete ${contact.data.shop_name || contact.phone}?`)) {
                                  onDeleteContact(contact.id);
                                }
                              }}
                              className="text-red-600 hover:text-red-800 text-sm"
                              title="Delete Contact"
                            >
                              🗑️
                            </button>
                          </div>
                        );
                      default:
                        return null;
                    }
                  };
                  
                  return (
                    <td key={column.id} className={`px-6 py-4 whitespace-nowrap ${column.width}`}>
                      {getCellContent()}
                    </td>
                  );
                })}
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
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-semibold touch-manipulation"
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
  const [activeTab, setActiveTab] = useState('pending'); // pending or completed
  const [dateFilter, setDateFilter] = useState('today');
  const [customDate, setCustomDate] = useState('');
  const [filteredFollowups, setFilteredFollowups] = useState([]);
  const [completedFollowups, setCompletedFollowups] = useState([]);
  const [localLoading, setLocalLoading] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [selectedFollowup, setSelectedFollowup] = useState(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [callStatus, setCallStatus] = useState('');
  const [scheduleNext, setScheduleNext] = useState(false);
  const [nextFollowupDate, setNextFollowupDate] = useState('');
  const [nextFollowupNotes, setNextFollowupNotes] = useState('');
  const [showContactDetailModal, setShowContactDetailModal] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [statistics, setStatistics] = useState({
    total: 0,
    completed: 0,
    pending: 0,
    overdue: 0
  });

  const openCompletionModal = (followup) => {
    setSelectedFollowup(followup);
    setShowCompletionModal(true);
    setCompletionNotes('');
    setCallStatus(followup.contact?.status || '');
    setScheduleNext(false);
    setNextFollowupDate('');
    setNextFollowupNotes('');
  };
  
  const openContactDetailModal = (followup) => {
    if (followup.contact) {
      setSelectedContact(followup.contact);
      setShowContactDetailModal(true);
    }
  };

  const handleCompleteFollowup = async () => {
    if (!selectedFollowup) return;
    
    try {
      // Complete the current follow-up
      await axios.put(`${API}/followups/${selectedFollowup.id}/complete`);
      
      // Update contact status if selected
      if (callStatus) {
        await axios.put(`${API}/contacts/${selectedFollowup.contact_id}`, {
          status: callStatus
        });
      }
      
      // Add completion notes if provided
      if (completionNotes.trim() || callStatus) {
        const noteContent = callStatus 
          ? `Follow-up completed - Status: ${callStatus}${completionNotes.trim() ? `. Notes: ${completionNotes}` : ''}`
          : `Follow-up completed: ${completionNotes}`;
        
        await axios.post(`${API}/notes`, {
          contact_id: selectedFollowup.contact_id,
          content: noteContent
        });
      }
      
      // Schedule next follow-up if requested
      if (scheduleNext && nextFollowupDate) {
        await axios.post(`${API}/followups`, {
          contact_id: selectedFollowup.contact_id,
          follow_up_date: new Date(nextFollowupDate).toISOString(),
          notes: nextFollowupNotes || 'Next follow-up scheduled'
        });
      }
      
      // Close modal and refresh data
      setShowCompletionModal(false);
      fetchFilteredFollowups(); // Refresh the current view
      onRefresh();
      
      // Refresh dashboard and activity logs
      if (window.refreshFollowups) {
        window.refreshFollowups();
      }
      if (window.refreshActivityLogs) {
        window.refreshActivityLogs();
      }
      
      alert('Follow-up completed successfully!');
    } catch (error) {
      alert('Failed to complete follow-up');
    }
  };

  const fetchFilteredFollowups = async () => {
    setLocalLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      // Determine which date filter to use
      const filterToUse = customDate ? 'custom' : dateFilter;
      const params = { 
        date_filter: filterToUse, 
        skip: 0, 
        limit: 100 
      };
      
      // Add custom_date if a date is selected
      if (customDate) {
        params.custom_date = customDate;
      }
      
      // Fetch pending follow-ups
      const pendingResponse = await axios.get(`${API}/followups/paginated`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      
      // Fetch completed follow-ups for the selected date
      const completedResponse = await axios.get(`${API}/followups/completed`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      
      setFilteredFollowups(pendingResponse.data.followups || []);
      setCompletedFollowups(completedResponse.data.followups || []);
      
      // Calculate statistics
      const pending = pendingResponse.data.followups || [];
      const completed = completedResponse.data.followups || [];
      const overdue = pending.filter(f => f.status === 'overdue');
      
      setStatistics({
        total: pending.length + completed.length,
        completed: completed.length,
        pending: pending.length,
        overdue: overdue.length
      });
    } catch (error) {
      console.error('Failed to fetch follow-ups:', error);
    } finally {
      setLocalLoading(false);
    }
  };

  useEffect(() => {
    fetchFilteredFollowups();
  }, [dateFilter, customDate]);

  const displayFollowups = activeTab === 'pending' ? filteredFollowups : completedFollowups;

  return (
    <div>
      {/* Header with Date Filter */}
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-800 mb-4">Follow-ups Management</h2>
        
        {/* Date Filter Buttons and Custom Date Picker */}
        <div className="space-y-3 mb-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setDateFilter('today');
                setCustomDate('');
              }}
              className={`px-4 py-2 rounded-lg transition font-medium ${dateFilter === 'today' && !customDate ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            >
              📅 Today
            </button>
            <button
              onClick={() => {
                setDateFilter('tomorrow');
                setCustomDate('');
              }}
              className={`px-4 py-2 rounded-lg transition font-medium ${dateFilter === 'tomorrow' && !customDate ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            >
              📅 Tomorrow
            </button>
            <button
              onClick={() => {
                setDateFilter('this_week');
                setCustomDate('');
              }}
              className={`px-4 py-2 rounded-lg transition font-medium ${dateFilter === 'this_week' && !customDate ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            >
              📅 This Week
            </button>
            <button
              onClick={() => {
                setDateFilter('next_week');
                setCustomDate('');
              }}
              className={`px-4 py-2 rounded-lg transition font-medium ${dateFilter === 'next_week' && !customDate ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            >
              📅 Next Week
            </button>
          </div>
          
          {/* Custom Date Picker */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Or select a specific date:</label>
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            {customDate && (
              <button
                onClick={() => setCustomDate('')}
                className="px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition text-sm"
              >
                Clear
              </button>
            )}
          </div>
        </div>
        
        {/* Statistics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-blue-500">
            <p className="text-sm text-gray-600 font-medium">Total Follow-ups</p>
            <p className="text-3xl font-bold text-gray-800">{statistics.total}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-green-500">
            <p className="text-sm text-gray-600 font-medium">Completed</p>
            <p className="text-3xl font-bold text-green-600">{statistics.completed}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-yellow-500">
            <p className="text-sm text-gray-600 font-medium">Pending</p>
            <p className="text-3xl font-bold text-yellow-600">{statistics.pending}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-red-500">
            <p className="text-sm text-gray-600 font-medium">Overdue</p>
            <p className="text-3xl font-bold text-red-600">{statistics.overdue}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex-1 px-6 py-3 font-semibold transition ${
              activeTab === 'pending' 
                ? 'border-b-2 border-indigo-600 text-indigo-600' 
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            ⏰ Pending ({statistics.pending})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`flex-1 px-6 py-3 font-semibold transition ${
              activeTab === 'completed' 
                ? 'border-b-2 border-green-600 text-green-600' 
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            ✅ Completed ({statistics.completed})
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {localLoading ? (
            <div className="text-center py-12 text-gray-600">
              <div className="inline-flex items-center">
                <svg className="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="ml-3 text-lg">Loading follow-ups...</span>
              </div>
            </div>
          ) : displayFollowups.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">
                {activeTab === 'pending' 
                  ? `No pending follow-ups for ${customDate ? new Date(customDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : dateFilter === 'today' ? 'today' : dateFilter === 'tomorrow' ? 'tomorrow' : dateFilter === 'this_week' ? 'this week' : 'next week'}`
                  : `No completed follow-ups for ${customDate ? new Date(customDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : dateFilter === 'today' ? 'today' : dateFilter === 'tomorrow' ? 'tomorrow' : dateFilter === 'this_week' ? 'this week' : 'next week'}`
                }
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {displayFollowups.map(followup => {
                const isOverdue = followup.status === 'overdue';
                const isCompleted = followup.status === 'completed';
                
                return (
                  <div 
                    key={followup.id} 
                    className={`${
                      isCompleted ? 'bg-green-50 border-green-200' :
                      isOverdue ? 'bg-red-50 border-red-200' : 
                      'bg-blue-50 border-blue-200'
                    } border-2 rounded-lg p-4 cursor-pointer hover:shadow-md transition`}
                    onClick={() => openContactDetailModal(followup)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-bold text-lg text-gray-800">{getContactName(followup)}</p>
                        <p className="text-sm text-gray-600 mt-1">📞 {getContactPhone(followup)}</p>
                        {followup.contact?.assigned_staff && (
                          <p className="text-sm text-indigo-600 mt-1 font-medium">
                            👤 Staff: {followup.contact.assigned_staff}
                          </p>
                        )}
                        <p className={`text-sm font-medium mt-1 ${
                          isCompleted ? 'text-green-600' :
                          isOverdue ? 'text-red-600' : 
                          'text-indigo-600'
                        }`}>
                          ⏰ {isCompleted ? 'Completed:' : isOverdue ? 'Overdue:' : 'Scheduled:'} {format12Hour(followup.follow_up_date)}
                        </p>
                        {followup.notes && (
                          <p className="text-sm text-gray-700 mt-2 italic bg-white bg-opacity-50 p-2 rounded">
                            "{followup.notes}"
                          </p>
                        )}
                      </div>
                      {!isCompleted && (
                        <div className="flex gap-2 ml-4">
                          <a
                            href={`tel:${getContactPhone(followup)}`}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold whitespace-nowrap"
                            title="Call Now"
                            onClick={(e) => e.stopPropagation()}
                          >
                            📞 Call
                          </a>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openCompletionModal(followup);
                            }}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold whitespace-nowrap"
                          >
                            ✓ Complete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      
      {/* Follow-up Completion Modal */}
      {showCompletionModal && selectedFollowup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">Complete Follow-up</h2>
              <button 
                onClick={() => setShowCompletionModal(false)} 
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                &times;
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Contact Info */}
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="font-semibold text-gray-800">{getContactName(selectedFollowup)}</p>
                <p className="text-sm text-gray-600">📞 {getContactPhone(selectedFollowup)}</p>
                <p className="text-sm text-gray-600">Due: {format12Hour(selectedFollowup.follow_up_date)}</p>
                {selectedFollowup.notes && (
                  <p className="text-sm text-gray-500 mt-1 italic">"{selectedFollowup.notes}"</p>
                )}
              </div>
              
              {/* Call Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Call Outcome Status
                </label>
                <select
                  value={callStatus}
                  onChange={(e) => setCallStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="">Select call outcome...</option>
                  <option value="Called">📞 Called - Contact established</option>
                  <option value="Not Attending">⏸️ Not Attending - Unavailable/Busy</option>
                  <option value="Interested">✅ Interested - Positive response</option>
                  <option value="Not Interested">❌ Not Interested - Declined</option>
                  <option value="Follow-up">⏰ Follow-up - Needs reconnection</option>
                  <option value="Logged In">🎯 Logged In - Purchased & Active</option>
                  <option value="Irrelevant">🚫 Irrelevant - Wrong target</option>
                </select>
              </div>
              
              {/* Completion Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Call Notes (Optional)
                </label>
                <textarea
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  placeholder="Any additional details about the call..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  rows="3"
                />
              </div>
              
              {/* Schedule Next Follow-up */}
              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={scheduleNext}
                    onChange={(e) => setScheduleNext(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Schedule Next Follow-up
                  </span>
                </label>
              </div>
              
              {scheduleNext && (
                <div className="space-y-3 ml-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Next Follow-up Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={nextFollowupDate}
                      onChange={(e) => setNextFollowupDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      required={scheduleNext}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Next Follow-up Notes (Optional)
                    </label>
                    <input
                      type="text"
                      value={nextFollowupNotes}
                      onChange={(e) => setNextFollowupNotes(e.target.value)}
                      placeholder="Purpose of next follow-up..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}
              
              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowCompletionModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCompleteFollowup}
                  disabled={scheduleNext && !nextFollowupDate}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition font-semibold"
                >
                  ✓ confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Contact Detail Modal - reused from contacts section */}
      {showContactDetailModal && selectedContact && (
        <ContactDetailModal
          contact={selectedContact}
          onClose={() => setShowContactDetailModal(false)}
          onUpdate={async (updates) => {
            try {
              await axios.put(`${API}/contacts/${selectedContact.id}`, updates);
              alert('Contact updated successfully!');
              // Refresh followups and dashboard data
              onRefresh();
              if (window.refreshFollowups) {
                window.refreshFollowups();
              }
            } catch (error) {
              alert('Failed to update contact');
            }
          }}
          onDelete={async () => {
            if (!window.confirm('Are you sure you want to delete this contact?')) return;
            
            try {
              await axios.delete(`${API}/contacts/${selectedContact.id}`);
              setShowContactDetailModal(false);
              onRefresh();
              if (window.refreshFollowups) {
                window.refreshFollowups();
              }
              alert('Contact deleted successfully!');
            } catch (error) {
              alert('Failed to delete contact');
            }
          }}
          onLogCall={async () => {
            try {
              await axios.post(`${API}/contacts/${selectedContact.id}/call`);
              alert('Call logged successfully!');
              if (window.refreshActivityLogs) {
                window.refreshActivityLogs();
              }
            } catch (error) {
              alert('Failed to log call');
            }
          }}
          onUpdateStatus={async (status) => {
            try {
              await axios.put(`${API}/contacts/${selectedContact.id}`, { status });
              setSelectedContact({ ...selectedContact, status });
              if (window.refreshFollowups) {
                window.refreshFollowups();
              }
            } catch (error) {
              alert('Failed to update status');
            }
          }}
          onFollowupCreated={onRefresh}
        />
      )}
    </div>
  );
};

// Meetings View
const MeetingsView = ({ contacts, globalMeetings = [] }) => {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showNewMeetingModal, setShowNewMeetingModal] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingTime, setMeetingTime] = useState('');
  const [meetingLocation, setMeetingLocation] = useState('');
  const [meetingNotes, setMeetingNotes] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [customDateFilter, setCustomDateFilter] = useState('');
  const [activeTab, setActiveTab] = useState('upcoming');
  const [meetingSearchQuery, setMeetingSearchQuery] = useState('');
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [newMeetingDate, setNewMeetingDate] = useState('');
  const [newMeetingTime, setNewMeetingTime] = useState('');

  useEffect(() => {
    fetchMeetings();
    
    // Global function to open meeting modal with pre-selected contacts
    window.openNewMeetingModal = (preselectedContacts) => {
      console.log('openNewMeetingModal called with contacts:', preselectedContacts);
      resetMeetingForm();
      if (Array.isArray(preselectedContacts) && preselectedContacts.length > 0) {
        console.log('Setting selected contacts:', preselectedContacts);
        setSelectedContacts(preselectedContacts);
      }
      console.log('Opening meeting modal');
      setShowNewMeetingModal(true);
    };
    
    // Check if there's a pending meeting contact from scheduleMeetingFromContact
    if (window.pendingMeetingContact) {
      console.log('Found pending meeting contact:', window.pendingMeetingContact);
      setTimeout(() => {
        if (window.openNewMeetingModal && window.pendingMeetingContact) {
          window.openNewMeetingModal([window.pendingMeetingContact]);
          window.pendingMeetingContact = null;
        }
      }, 200);
    }
    
    return () => {
      delete window.openNewMeetingModal;
    };
  }, [globalMeetings]);

  useEffect(() => {
    if (searchQuery) {
      const filtered = contacts.filter(contact => {
        const name = contact.data?.name || contact.data?.Name || '';
        const shopName = contact.data?.shop_name || contact.data?.Shop_Name || contact.data?.['Shop Name'] || '';
        const phone = contact.phone || '';
        
        const searchLower = searchQuery.toLowerCase();
        return name.toLowerCase().includes(searchLower) || 
               shopName.toLowerCase().includes(searchLower) ||
               phone.includes(searchQuery);
      });
      setFilteredContacts(filtered);
    } else {
      setFilteredContacts([]);
    }
  }, [searchQuery, contacts]);
  
  const filterMeetingsByDate = (meetings, filter) => {
    if (filter === 'all') return meetings;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const nextWeekEnd = new Date(today);
    nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);
    
    return meetings.filter(meeting => {
      const meetingDate = new Date(meeting.date);
      meetingDate.setHours(0, 0, 0, 0);
      
      switch (filter) {
        case 'today':
          return meetingDate.getTime() === today.getTime();
        case 'tomorrow':
          return meetingDate.getTime() === tomorrow.getTime();
        case 'this-week':
          return meetingDate >= today && meetingDate < nextWeekEnd;
        case 'custom':
          if (!customDateFilter) return false;
          const customDate = new Date(customDateFilter);
          customDate.setHours(0, 0, 0, 0);
          return meetingDate.getTime() === customDate.getTime();
        default:
          return true;
      }
    });
  };

  const fetchMeetings = async () => {
    // Use globalMeetings from Dashboard (already fetched from database)
    setMeetings(globalMeetings);
  };

  const updateMeetingStatus = async (meetingId, status) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/meetings/${meetingId}/status`, 
        { status: status }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Refresh meetings by calling parent's fetchMeetings
      if (window.refreshMeetings) {
        window.refreshMeetings();
      }
      
      // Refresh activity logs
      if (window.refreshActivityLogs) {
        window.refreshActivityLogs();
      }
      
      alert(`Meeting ${status} successfully!`);
    } catch (error) {
      console.error('Failed to update meeting status:', error);
      alert('Failed to update meeting status');
    }
  };

  const deleteMeeting = async (meetingId) => {
    if (!confirm('Are you sure you want to delete this meeting?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/meetings/${meetingId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Refresh meetings by calling parent's fetchMeetings
      if (window.refreshMeetings) {
        window.refreshMeetings();
      }
      
      // Refresh activity logs
      if (window.refreshActivityLogs) {
        window.refreshActivityLogs();
      }
      
      alert('Meeting deleted successfully!');
    } catch (error) {
      console.error('Failed to delete meeting:', error);
      alert('Failed to delete meeting');
    }
  };

  const rescheduleMeeting = async () => {
    if (!rescheduleTarget || !newMeetingDate) {
      alert('Please select a new date');
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/meetings/${rescheduleTarget.id}`, 
        { 
          date: newMeetingDate,
          time: newMeetingTime || null
        }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Refresh meetings
      if (window.refreshMeetings) {
        window.refreshMeetings();
      }
      
      // Refresh activity logs
      if (window.refreshActivityLogs) {
        window.refreshActivityLogs();
      }
      
      setShowRescheduleModal(false);
      setRescheduleTarget(null);
      setNewMeetingDate('');
      setNewMeetingTime('');
      alert('Meeting rescheduled successfully!');
    } catch (error) {
      console.error('Failed to reschedule meeting:', error);
      alert('Failed to reschedule meeting');
    }
  };

  const filterMeetingsBySearch = (meetings) => {
    if (!meetingSearchQuery) return meetings;
    
    const query = meetingSearchQuery.toLowerCase();
    return meetings.filter(meeting => 
      meeting.title.toLowerCase().includes(query) ||
      meeting.location?.toLowerCase().includes(query) ||
      meeting.notes?.toLowerCase().includes(query) ||
      meeting.attendees?.some(attendee => 
        attendee.name.toLowerCase().includes(query) ||
        attendee.phone.includes(query)
      )
    );
  };



  const handleContactSelection = (contact) => {
    const isAlreadySelected = selectedContacts.some(c => c.id === contact.id);
    
    if (isAlreadySelected) {
      setSelectedContacts(selectedContacts.filter(c => c.id !== contact.id));
    } else {
      setSelectedContacts([...selectedContacts, contact]);
    }
  };

  const resetMeetingForm = () => {
    setMeetingTitle('');
    setMeetingDate('');
    setMeetingTime('');
    setMeetingLocation('');
    setMeetingNotes('');
    setSelectedContacts([]);
    setSearchQuery('');
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800">Meetings</h2>
        <button
          onClick={() => setShowNewMeetingModal(true)}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-semibold"
        >
          + Schedule Meeting
        </button>
      </div>
      
      {/* Search Bar */}
      <div className="bg-white rounded-xl shadow-md p-4 mb-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search meetings by title, location, notes, or attendees..."
              value={meetingSearchQuery}
              onChange={(e) => setMeetingSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          {meetingSearchQuery && (
            <button
              onClick={() => setMeetingSearchQuery('')}
              className="px-3 py-2 text-gray-500 hover:text-gray-700 transition"
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Date filters */}
      <div className="bg-white rounded-xl shadow-md p-4 mb-6 flex flex-wrap gap-4">
        <div className="flex gap-2 items-center flex-wrap">
          <button
            onClick={() => setDateFilter('all')}
            className={`px-4 py-2 rounded-lg transition ${dateFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
          >
            All Meetings
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
            onClick={() => setDateFilter('this-week')}
            className={`px-4 py-2 rounded-lg transition ${dateFilter === 'this-week' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
          >
            This Week
          </button>
        </div>
        <div className="flex gap-2 items-center ml-auto">
          <input
            type="date"
            value={customDateFilter}
            onChange={(e) => {
              setCustomDateFilter(e.target.value);
              if (e.target.value) {
                setDateFilter('custom');
              }
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
          {customDateFilter && (
            <button 
              onClick={() => {
                setCustomDateFilter('');
                setDateFilter('all');
              }}
              className="text-gray-500 hover:text-gray-700"
              title="Clear custom date"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-600">Loading meetings...</div>
      ) : meetings.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <div className="text-6xl mb-4">📅</div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No Meetings Scheduled</h3>
          <p className="text-gray-500 mb-6">Schedule your first meeting to get started</p>
          <button
            onClick={() => setShowNewMeetingModal(true)}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-semibold"
          >
            + Schedule Meeting
          </button>
        </div>
      ) : (
        <>
          {(() => {
            const dateFilteredMeetings = filterMeetingsByDate(meetings, dateFilter);
            const searchFilteredMeetings = filterMeetingsBySearch(dateFilteredMeetings);
            const upcomingMeetings = searchFilteredMeetings.filter(meeting => meeting.status === 'scheduled');
            const completedMeetings = searchFilteredMeetings.filter(meeting => meeting.status === 'completed');
            const cancelledMeetings = searchFilteredMeetings.filter(meeting => meeting.status === 'cancelled');
            
            if (searchFilteredMeetings.length === 0) {
              return (
                <div className="bg-white rounded-xl shadow-md p-6 text-center">
                  <div className="text-4xl mb-3">📅</div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">No Meetings Found</h3>
                  <p className="text-gray-500">
                    {meetingSearchQuery 
                      ? `No meetings match "${meetingSearchQuery}"` 
                      : "No meetings scheduled for the selected date filter"
                    }
                  </p>
                  {meetingSearchQuery && (
                    <button
                      onClick={() => setMeetingSearchQuery('')}
                      className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                    >
                      Clear Search
                    </button>
                  )}
                </div>
              );
            }
            
            return (
              <div className="bg-white rounded-xl shadow-md overflow-hidden">
                {/* Tab Navigation */}
                <div className="border-b border-gray-200">
                  <nav className="flex">
                    <button
                      onClick={() => setActiveTab('upcoming')}
                      className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'upcoming'
                          ? 'border-green-500 text-green-600 bg-green-50'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      📅 Upcoming ({upcomingMeetings.length})
                    </button>
                    <button
                      onClick={() => setActiveTab('completed')}
                      className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'completed'
                          ? 'border-blue-500 text-blue-600 bg-blue-50'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      ✅ Completed ({completedMeetings.length})
                    </button>
                    <button
                      onClick={() => setActiveTab('cancelled')}
                      className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'cancelled'
                          ? 'border-red-500 text-red-600 bg-red-50'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      ❌ Cancelled ({cancelledMeetings.length})
                    </button>
                  </nav>
                </div>

                {/* Tab Content */}
                <div className="p-6">
                  {/* Upcoming Meetings Tab */}
                  {activeTab === 'upcoming' && (
                    <div>
                      {upcomingMeetings.length === 0 ? (
                        <div className="text-center py-8">
                          <div className="text-4xl mb-3">📅</div>
                          <h3 className="text-lg font-semibold text-gray-700 mb-2">No Upcoming Meetings</h3>
                          <p className="text-gray-500 mb-4">Schedule your next meeting to get started</p>
                          <button
                            onClick={() => setShowNewMeetingModal(true)}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold"
                          >
                            + Schedule Meeting
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {upcomingMeetings.map(meeting => (
                            <div key={meeting.id} className="bg-gray-50 rounded-lg p-4">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <h3 className="text-lg font-semibold text-indigo-700">{meeting.title}</h3>
                                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                                    <span>📅 {meeting.date} {meeting.time && `at ${meeting.time}`}</span>
                                    {meeting.location && <span>📍 {meeting.location}</span>}
                                  </div>
                                  {meeting.notes && (
                                    <p className="text-gray-600 text-sm mt-1 italic">"{meeting.notes}"</p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    ✓ Scheduled
                                  </span>
                                </div>
                              </div>
                              
                              {meeting.attendees && meeting.attendees.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-gray-200">
                                  <div className="flex flex-wrap gap-1">
                                    {meeting.attendees.map(attendee => (
                                      <span key={attendee.id} className="inline-flex items-center bg-indigo-50 text-indigo-700 rounded px-2 py-1 text-xs">
                                        {attendee.name} ({attendee.phone})
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              <div className="mt-3 flex gap-2 flex-wrap">
                                <button 
                                  onClick={() => updateMeetingStatus(meeting.id, 'completed')}
                                  className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition"
                                >
                                  ✓ Complete
                                </button>
                                <button 
                                  onClick={() => {
                                    setRescheduleTarget(meeting);
                                    setNewMeetingDate(meeting.date);
                                    setNewMeetingTime(meeting.time || '');
                                    setShowRescheduleModal(true);
                                  }}
                                  className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                                >
                                  📅 Reschedule
                                </button>
                                <button 
                                  onClick={() => updateMeetingStatus(meeting.id, 'cancelled')}
                                  className="px-3 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700 transition"
                                >
                                  ⏸️ Cancel
                                </button>
                                <button 
                                  onClick={() => deleteMeeting(meeting.id)}
                                  className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition"
                                >
                                  🗑️ Delete
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Completed Meetings Tab */}
                  {activeTab === 'completed' && (
                    <div>
                      {completedMeetings.length === 0 ? (
                        <div className="text-center py-8">
                          <div className="text-4xl mb-3">✅</div>
                          <h3 className="text-lg font-semibold text-gray-700 mb-2">No Completed Meetings</h3>
                          <p className="text-gray-500">Completed meetings will appear here</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {completedMeetings.map(meeting => (
                            <div key={meeting.id} className="bg-blue-50 rounded-lg p-4">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <h3 className="text-lg font-semibold text-gray-700">{meeting.title}</h3>
                                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                                    <span>📅 {meeting.date} {meeting.time && `at ${meeting.time}`}</span>
                                    {meeting.location && <span>📍 {meeting.location}</span>}
                                  </div>
                                  {meeting.notes && (
                                    <p className="text-gray-600 text-sm mt-1 italic">"{meeting.notes}"</p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    ✓ Completed
                                  </span>
                                </div>
                              </div>
                              
                              {meeting.attendees && meeting.attendees.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-blue-200">
                                  <div className="flex flex-wrap gap-1">
                                    {meeting.attendees.map(attendee => (
                                      <span key={attendee.id} className="inline-flex items-center bg-blue-100 text-blue-700 rounded px-2 py-1 text-xs">
                                        {attendee.name} ({attendee.phone})
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              <div className="mt-3 flex gap-2">
                                <button 
                                  onClick={() => deleteMeeting(meeting.id)}
                                  className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Cancelled Meetings Tab */}
                  {activeTab === 'cancelled' && (
                    <div>
                      {cancelledMeetings.length === 0 ? (
                        <div className="text-center py-8">
                          <div className="text-4xl mb-3">❌</div>
                          <h3 className="text-lg font-semibold text-gray-700 mb-2">No Cancelled Meetings</h3>
                          <p className="text-gray-500">Cancelled meetings will appear here</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {cancelledMeetings.map(meeting => (
                            <div key={meeting.id} className="bg-red-50 rounded-lg p-4">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <h3 className="text-lg font-semibold text-gray-600 line-through">{meeting.title}</h3>
                                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                                    <span className="line-through">📅 {meeting.date} {meeting.time && `at ${meeting.time}`}</span>
                                    {meeting.location && <span className="line-through">📍 {meeting.location}</span>}
                                  </div>
                                  {meeting.notes && (
                                    <p className="text-gray-500 text-sm mt-1 italic line-through">"{meeting.notes}"</p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                    ✗ Cancelled
                                  </span>
                                </div>
                              </div>
                              
                              {meeting.attendees && meeting.attendees.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-red-200">
                                  <div className="flex flex-wrap gap-1">
                                    {meeting.attendees.map(attendee => (
                                      <span key={attendee.id} className="inline-flex items-center bg-red-100 text-red-700 rounded px-2 py-1 text-xs line-through">
                                        {attendee.name} ({attendee.phone})
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              <div className="mt-3 flex gap-2">
                                <button 
                                  onClick={() => deleteMeeting(meeting.id)}
                                  className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </>
      )}

      {/* New Meeting Modal */}
      {showNewMeetingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto mx-4">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-800">Schedule New Meeting</h2>
              <button onClick={() => setShowNewMeetingModal(false)} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
            </div>

            <div className="p-6 space-y-6">
              {/* Meeting Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Title *</label>
                  <input
                    type="text"
                    value={meetingTitle}
                    onChange={(e) => setMeetingTitle(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    placeholder="e.g., Product Demo, Contract Discussion"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                    <input
                      type="date"
                      value={meetingDate}
                      onChange={(e) => setMeetingDate(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Time *</label>
                    <input
                      type="time"
                      value={meetingTime}
                      onChange={(e) => setMeetingTime(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label>
                    <input
                      type="number"
                      value={meetingDuration}
                      onChange={(e) => setMeetingDuration(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      min="15"
                      step="15"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Type</label>
                    <select
                      value={meetingType}
                      onChange={(e) => setMeetingType(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="in-person">In Person</option>
                      <option value="virtual">Virtual</option>
                      <option value="phone">Phone Call</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <input
                    type="text"
                    value={meetingLocation}
                    onChange={(e) => setMeetingLocation(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    placeholder="e.g., Office, Zoom link, etc."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={meetingNotes}
                    onChange={(e) => setMeetingNotes(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    rows="3"
                    placeholder="Meeting agenda, things to prepare, etc."
                  ></textarea>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={meetingStatus}
                    onChange={(e) => setMeetingStatus(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="tentative">Tentative</option>
                  </select>
                </div>
              </div>

              {/* Contact Selection */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-3">Select Attendees *</h3>
                <div className="mb-4">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search contacts..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                {/* Selected Contacts */}
                {selectedContacts.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Selected:</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedContacts.map(contact => (
                        <div
                          key={contact.id}
                          className="inline-flex items-center bg-indigo-50 border border-indigo-200 rounded-full px-3 py-1"
                        >
                          <span className="text-sm text-indigo-800">
                            {contact.data?.shop_name || contact.data?.Shop_Name || contact.data?.['Shop Name'] || contact.phone}
                          </span>
                          <button
                            onClick={() => handleContactSelection(contact)}
                            className="ml-2 text-indigo-600 hover:text-indigo-800"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Contact Search Results */}
                {searchQuery && filteredContacts.length > 0 && (
                  <div className="max-h-60 overflow-y-auto border rounded-lg divide-y">
                    {filteredContacts.map(contact => {
                      const isSelected = selectedContacts.some(c => c.id === contact.id);
                      const shopName = contact.data?.shop_name || contact.data?.Shop_Name || contact.data?.['Shop Name'];
                      const contactName = contact.data?.name || contact.data?.Name;
                      
                      return (
                        <div
                          key={contact.id}
                          onClick={() => handleContactSelection(contact)}
                          className={`p-3 cursor-pointer ${isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
                        >
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              readOnly
                              className="mr-3 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                            />
                            <div>
                              {shopName && <p className="font-medium text-gray-800">{shopName}</p>}
                              {contactName && <p className="text-sm text-gray-600">{contactName}</p>}
                              <p className="text-sm text-gray-600">{contact.phone}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {searchQuery && filteredContacts.length === 0 && (
                  <div className="text-center py-4 text-gray-500">
                    No contacts found matching "{searchQuery}"
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={() => setShowNewMeetingModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateMeeting}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-semibold"
                >
                  Schedule Meeting
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Meeting Modal */}
      {showRescheduleModal && rescheduleTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">Reschedule Meeting</h2>
              <button 
                onClick={() => {
                  setShowRescheduleModal(false);
                  setRescheduleTarget(null);
                  setNewMeetingDate('');
                  setNewMeetingTime('');
                }} 
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                &times;
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">{rescheduleTarget.title}</h3>
                <p className="text-sm text-gray-600">
                  Current: {rescheduleTarget.date} {rescheduleTarget.time && `at ${rescheduleTarget.time}`}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Date *</label>
                <input
                  type="date"
                  value={newMeetingDate}
                  onChange={(e) => setNewMeetingDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Time</label>
                <input
                  type="time"
                  value={newMeetingTime}
                  onChange={(e) => setNewMeetingTime(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={rescheduleMeeting}
                  className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition font-semibold"
                >
                  Reschedule Meeting
                </button>
                <button
                  onClick={() => {
                    setShowRescheduleModal(false);
                    setRescheduleTarget(null);
                    setNewMeetingDate('');
                    setNewMeetingTime('');
                  }}
                  className="flex-1 bg-gray-500 text-white py-2 rounded-lg hover:bg-gray-600 transition font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
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
      <h2 className="text-2xl lg:text-3xl font-bold text-gray-800 mb-4 lg:mb-6">Import Contacts from Excel</h2>

      <div className="bg-white rounded-xl shadow-md p-4 lg:p-6">
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
            <h3 className="text-base lg:text-lg font-semibold mb-4">Map Excel Columns to CRM Fields</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone 2 Column (Optional)
                </label>
                <select
                  value={mapping.phone2 || ''}
                  onChange={(e) => setMapping({ ...mapping, phone2: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select column...</option>
                  {columns.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Name Column (Optional)
                </label>
                <select
                  value={mapping.customer_name || ''}
                  onChange={(e) => setMapping({ ...mapping, customer_name: e.target.value })}
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
            className="w-full py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-semibold disabled:bg-gray-400 touch-manipulation"
          >
            {importing ? 'Importing...' : 'Import Contacts'}
          </button>
        )}

        {result && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h4 className="font-semibold text-green-800 mb-3 text-sm lg:text-base">Import Complete!</h4>
            <div className="space-y-2 text-xs lg:text-sm">
              <div className="flex justify-between">
                <span className="text-green-700">📊 Total Excel Rows:</span>
                <span className="font-medium text-green-800">{result.original_excel_rows || 0}</span>
              </div>
              {result.file_duplicates_removed > 0 && (
                <div className="flex justify-between">
                  <span className="text-orange-700">🗂️ File Duplicates Removed:</span>
                  <span className="font-medium text-orange-800">{result.file_duplicates_removed}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-blue-700">⚙️ Rows Processed:</span>
                <span className="font-medium text-blue-800">{result.total_processed || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-700">✅ Successfully Imported:</span>
                <span className="font-medium text-green-800">{result.imported}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-red-700">🔄 Database Duplicates:</span>
                <span className="font-medium text-red-800">{result.db_duplicates || 0}</span>
              </div>
              {result.empty_data_skipped > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">📝 Empty Data Skipped:</span>
                  <span className="font-medium text-gray-700">{result.empty_data_skipped}</span>
                </div>
              )}
              <div className="border-t border-green-300 pt-2 mt-3">
                <div className="flex justify-between font-semibold">
                  <span className="text-green-700">📋 Total Skipped:</span>
                  <span className="text-green-800">{result.skipped}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Demo Reports View
const DemoReportsView = () => {
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
    end: new Date().toISOString().split('T')[0] // today
  });
  const [groupBy, setGroupBy] = useState('day');
  const [reportData, setReportData] = useState([]);
  const [summary, setSummary] = useState({ given: 0, watched: 0, conversion: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchReportData();
  }, [dateRange, groupBy]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const startDate = new Date(dateRange.start).toISOString();
      const endDate = new Date(dateRange.end + 'T23:59:59').toISOString();
      
      const [reportResponse, summaryResponse] = await Promise.all([
        axios.get(`${API}/demos/report?start=${startDate}&end=${endDate}&group_by=${groupBy}`),
        axios.get(`${API}/demos/summary?start=${startDate}&end=${endDate}`)
      ]);
      
      setReportData(reportResponse.data);
      setSummary(summaryResponse.data);
    } catch (error) {
      console.error('Failed to fetch demo report:', error);
    } finally {
      setLoading(false);
    }
  };

  const setQuickRange = (days) => {
    const end = new Date().toISOString().split('T')[0];
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setDateRange({ start, end });
  };

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-800 mb-6">🎬 Demo Reports</h2>
      
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-orange-500">
          <h3 className="text-gray-600 text-sm font-medium mb-2">Demos Given</h3>
          <p className="text-4xl font-bold text-gray-800">{summary.given}</p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-green-500">
          <h3 className="text-gray-600 text-sm font-medium mb-2">Demos Watched</h3>
          <p className="text-4xl font-bold text-gray-800">{summary.watched}</p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-500">
          <h3 className="text-gray-600 text-sm font-medium mb-2">Conversion Rate</h3>
          <p className="text-4xl font-bold text-gray-800">{(summary.conversion * 100).toFixed(1)}%</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-8">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex gap-2">
            <button onClick={() => setQuickRange(7)} className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm">Last 7 days</button>
            <button onClick={() => setQuickRange(30)} className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm">Last 30 days</button>
            <button onClick={() => setQuickRange(90)} className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm">Last 90 days</button>
          </div>
          
          <div className="flex gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Group By</label>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="day">Daily</option>
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Report Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">Demo Activity Report</h3>
        </div>
        
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="mt-2 text-gray-600">Loading report data...</p>
          </div>
        ) : reportData.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>No demo data found for the selected date range.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Demos Given</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Demos Watched</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Conversion Rate</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reportData.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{row.period}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                        {row.given}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {row.watched}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2 max-w-20">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${Math.min(row.conversion * 100, 100)}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {(row.conversion * 100).toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
      case 'Called contact':
        return '📞 Call Logged';
      case 'Added note':
        return '📝 Note Added';
      case 'Imported contacts':
        return '📤 Contacts Imported';
      case 'Created meeting':
        return '📅 Meeting Scheduled';
      case 'Rescheduled meeting':
        return '📅 Meeting Rescheduled';
      case 'Completed meeting':
        return '✅ Meeting Completed';
      case 'Cancelled meeting':
        return '❌ Meeting Cancelled';
      case 'Deleted meeting':
        return '🗑️ Meeting Deleted';
      case 'Updated meeting':
        return '✏️ Meeting Updated';
      default:
        // Handle dynamic meeting status updates
        if (log.action.startsWith('Updated meeting status to')) {
          const status = log.action.replace('Updated meeting status to ', '');
          if (status === 'completed') return '✅ Meeting Completed';
          if (status === 'cancelled') return '❌ Meeting Cancelled';
          return '📝 Meeting Status Updated';
        }
        return log.action;
    }
  };

  // Helper function to get contact from log (reused by both shop name and phone functions)
  const getContactFromLog = (log) => {
    if (!contacts.length) return null;
    
    // If target is a phone number, find contact directly
    if (log.target && (log.target.startsWith('+91') || /^\+?\d+/.test(log.target))) {
      return contacts.find(c => c.phone === log.target);
    }
    
    // If target looks like a contact ID (UUID), find contact by various ID fields
    if (log.target && log.target.length === 36 && log.target.includes('-')) {
      return contacts.find(c => c.id === log.target) || 
             contacts.find(c => c.contact_id === log.target) ||
             contacts.find(c => c._id === log.target);
    }
    
    // For contact operations, try to find contact by matching target with phone or shop name
    if (log.action && (log.action.includes('Contact') || log.action.includes('contact'))) {
      if (log.target) {
        // Try to find by phone number (target might be phone without country code)
        let foundContact = contacts.find(c => c.phone === log.target || c.phone === `+91${log.target}`);
        if (foundContact) return foundContact;
        
        // Try to find by shop name
        foundContact = contacts.find(c => 
          (c.data.shop_name && c.data.shop_name === log.target) ||
          (c.data.Shop_Name && c.data.Shop_Name === log.target) ||
          (c.data['Shop Name'] && c.data['Shop Name'] === log.target)
        );
        if (foundContact) return foundContact;
      }
      
      // If we have details, try to extract information from there
      if (log.details) {
        const phoneMatch = log.details.match(/\+91\d{10}|\d{10}/);
        if (phoneMatch) {
          const phone = phoneMatch[0].startsWith('+91') ? phoneMatch[0] : `+91${phoneMatch[0]}`;
          const foundContact = contacts.find(c => c.phone === phone);
          if (foundContact) return foundContact;
        }
      }
    }
    
    // For meeting-related actions, try to find contact from meeting details
    if (log.action && log.action.toLowerCase().includes('meeting') && log.details) {
      // Try to extract contact information from details
      // Look for meeting details that might contain attendee information
      const phoneMatch = log.details.match(/\+91\d{10}|\d{10}/);
      if (phoneMatch) {
        const phone = phoneMatch[0].startsWith('+91') ? phoneMatch[0] : `+91${phoneMatch[0]}`;
        return contacts.find(c => c.phone === phone);
      }
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
    
    // For deleted contacts, extract shop name from log details
    if (log.action === 'Deleted contact' && log.details) {
      console.log('Checking deleted contact log details:', log.details);
      const shopMatch = log.details.match(/Shop: ([^,]+)/);
      if (shopMatch && shopMatch[1] && shopMatch[1] !== 'Unknown Shop') {
        console.log('Found shop name from deleted contact details:', shopMatch[1]);
        return shopMatch[1];
      }
    }
    
    // For other contact operations, extract from details if available
    if (log.action && (log.action.includes('Contact') || log.action.includes('contact')) && log.details) {
      console.log('Checking contact operation log details:', log.details);
      const shopMatch = log.details.match(/Shop: ([^,]+)/);
      if (shopMatch && shopMatch[1] && shopMatch[1] !== 'Unknown Shop') {
        console.log('Found shop name from contact operation details:', shopMatch[1]);
        return shopMatch[1];
      }
    }
    
    // For contact operations, if target looks like a shop name, return it
    if (log.action && (log.action.includes('Contact') || log.action.includes('contact')) && log.target) {
      // If target doesn't look like a phone number or UUID, it might be a shop name or identifier
      if (!log.target.startsWith('+91') && !/^\+?\d+$/.test(log.target) && 
          !(log.target.length === 36 && log.target.includes('-'))) {
        // If it looks like meaningful text (not just random characters), return it as shop name
        if (log.target.length > 2) {
          return log.target;
        }
      }
      
      // Last resort: if we can't find a contact but have a target, try to find any contact with matching phone
      const foundContact = contacts.find(c => 
        c.phone && (c.phone === log.target || c.phone.includes(log.target) || log.target.includes(c.phone))
      );
      if (foundContact && foundContact.data) {
        const shopName = foundContact.data.shop_name || foundContact.data.Shop_Name || foundContact.data['Shop Name'];
        if (shopName) return shopName;
      }
    }
    
    // For meeting actions, try to show something more meaningful than N/A
    if (log.action && log.action.toLowerCase().includes('meeting')) {
      return 'Meeting Contact';
    }
    
    // Final fallback: if this is a contact operation and target doesn't look like a phone or UUID, use it as shop name
    if (log.action && (log.action.includes('Contact') || log.action.includes('contact')) && log.target) {
      // If target doesn't look like a phone number (+91xxxxxxxxxx or just digits) or UUID
      if (!log.target.match(/^\+?\d+$/) && !(log.target.length === 36 && log.target.includes('-'))) {
        console.log('Using target as shop name fallback:', log.target);
        return log.target;
      }
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
      
      // For meeting actions, try to extract contact phone from the contact found
      if (log.action && log.action.toLowerCase().includes('meeting')) {
        const contact = getContactFromLog(log);
        if (contact && contact.phone) {
          return `📱 ${contact.phone}`;
        }
        // If we have attendee info in details, try to extract phone
        if (log.details) {
          const phoneMatch = log.details.match(/\+91\d{10}|\d{10}/);
          if (phoneMatch) {
            const phone = phoneMatch[0].startsWith('+91') ? phoneMatch[0] : `+91${phoneMatch[0]}`;
            return `📱 ${phone}`;
          }
        }
        return `📅 ${log.target}`;
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
  const [demos, setDemos] = useState([]);
  const [editedContact, setEditedContact] = useState({
    phone: contact.phone,
    phone2: contact.data.phone2 || contact.data.Phone2 || contact.data['Phone 2'] || contact.data.alternate_phone || contact.data.secondary_phone || '',
    shop_name: contact.data.shop_name || contact.data.Shop_Name || contact.data['Shop Name'] || '',
    address: contact.data.address || contact.data.Address || contact.data['Address'] || '',
    city: contact.data.city || contact.data.City || contact.data['City'] || '',
    state: contact.data.state || contact.data.State || contact.data['State'] || '',
    category: contact.data.category || contact.data.Category || contact.data['Category'] || ''
  });

  useEffect(() => {
    fetchNotes();
    fetchDemos();
  }, [contact.id]);

  const fetchNotes = async () => {
    try {
      const response = await axios.get(`${API}/notes/contact/${contact.id}`);
      setNotes(response.data);
    } catch (error) {
      console.error('Failed to fetch notes:', error);
    }
  };

  const fetchDemos = async () => {
    try {
      const response = await axios.get(`${API}/contacts/${contact.id}/demos`);
      setDemos(response.data);
    } catch (error) {
      console.error('Failed to fetch demos:', error);
    }
  };

  const handleMarkDemoGiven = async () => {
    try {
      await axios.post(`${API}/demos`, {
        contact_id: contact.id
      });
      await fetchDemos();
      
      // Refresh activity logs for live updates
      if (window.refreshActivityLogs) {
        window.refreshActivityLogs();
      }
    } catch (error) {
      alert('Failed to mark demo as given');
    }
  };

  const handleMarkDemoWatched = async (demoId) => {
    try {
      await axios.put(`${API}/demos/${demoId}/watched`, {
        watched_at: new Date().toISOString()
      });
      await fetchDemos();
      
      // Refresh activity logs for live updates
      if (window.refreshActivityLogs) {
        window.refreshActivityLogs();
      }
    } catch (error) {
      console.error('Demo watched error:', error);
      alert('Failed to mark demo as watched');
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
          phone2: editedContact.phone2 || undefined,
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
      phone2: contact.data.phone2 || contact.data.Phone2 || contact.data['Phone 2'] || contact.data.alternate_phone || contact.data.secondary_phone || '',
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
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-auto mx-4">
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
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{contact.phone}</p>
                    <a
                      href={`tel:${contact.phone}`}
                      onClick={() => onLogCall(contact.id)}
                      className="text-indigo-600 hover:text-indigo-800"
                      title="Call"
                    >
                      📞
                    </a>
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm text-gray-600">Phone 2</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedContact.phone2}
                    onChange={(e) => setEditedContact({ ...editedContact, phone2: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg mt-1 font-medium"
                    placeholder="Secondary phone number"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{contact.data.phone2 || contact.data.Phone2 || contact.data['Phone 2'] || contact.data.alternate_phone || contact.data.secondary_phone || '-'}</p>
                    {(contact.data.phone2 || contact.data.Phone2 || contact.data['Phone 2'] || contact.data.alternate_phone || contact.data.secondary_phone) && (
                      <a
                        href={`tel:${contact.data.phone2 || contact.data.Phone2 || contact.data['Phone 2'] || contact.data.alternate_phone || contact.data.secondary_phone}`}
                        onClick={() => onLogCall(contact.id)}
                        className="text-indigo-600 hover:text-indigo-800"
                        title="Call Phone 2"
                      >
                        📞
                      </a>
                    )}
                  </div>
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
                onClick={() => {
                  // Wait for 1 second to show the confirmation (giving time for the call to be initiated)
                  setTimeout(async () => {
                    if (window.confirm('Did you complete the call?')) {
                      onLogCall(contact.id, contact.phone);
                    }
                  }, 1000);
                }}
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
              <button
                onClick={() => {
                  console.log('Schedule Meeting button clicked', contact);
                  if (window.scheduleMeetingFromContact) {
                    window.scheduleMeetingFromContact(contact);
                  } else {
                    console.error('scheduleMeetingFromContact function not available');
                  }
                }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                title="Schedule a meeting with this contact"
              >
                📅 Schedule Meeting
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

          {/* Demo Section */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">🎬 Demo Status</h3>
              {demos.length === 0 ? (
                <button
                  onClick={handleMarkDemoGiven}
                  className="px-3 py-1 bg-orange-600 text-white text-sm rounded-md hover:bg-orange-700"
                >
                  Mark Given
                </button>
              ) : (
                <span className="px-3 py-1 bg-gray-300 text-gray-600 text-sm rounded-md cursor-not-allowed">
                  Demo Given
                </span>
              )}
            </div>
            
            {demos.length > 0 && (
              <div className="space-y-2">
                {demos.slice(0, 1).map(demo => (
                  <div key={demo.id} className={`p-2 rounded text-xs ${demo.watched ? 'bg-green-50 border border-green-200' : 'bg-orange-50 border border-orange-200'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className={`font-medium ${demo.watched ? 'text-green-700' : 'text-orange-700'}`}>
                          {demo.watched ? '✅ Demo Completed' : '📤 Demo Given - Pending Watch'}
                        </div>
                        <div className="text-gray-600 mt-1">
                          Given: {format12Hour(demo.given_at)}
                        </div>
                        {demo.watched && demo.watched_at && (
                          <div className="text-gray-600">
                            Watched: {format12Hour(demo.watched_at)}
                          </div>
                        )}
                      </div>
                      {!demo.watched && (
                        <button
                          onClick={() => handleMarkDemoWatched(demo.id)}
                          className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
                        >
                          Mark Watched
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
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

// Global Meeting Modal (can be used from any view)
const GlobalMeetingModal = ({ contacts, selectedContacts, onClose, onSave }) => {
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingTime, setMeetingTime] = useState('');
  const [meetingLocation, setMeetingLocation] = useState('');
  const [meetingNotes, setMeetingNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentSelectedContacts, setCurrentSelectedContacts] = useState(selectedContacts || []);
  const [filteredContacts, setFiltereredContacts] = useState([]);

  useEffect(() => {
    setCurrentSelectedContacts(selectedContacts || []);
  }, [selectedContacts]);

  useEffect(() => {
    if (searchQuery) {
      const filtered = contacts.filter(contact => {
        const name = contact.data?.name || contact.data?.Name || '';
        const shopName = contact.data?.shop_name || contact.data?.Shop_Name || contact.data?.['Shop Name'] || '';
        const phone = contact.phone || '';
        
        const searchLower = searchQuery.toLowerCase();
        return name.toLowerCase().includes(searchLower) || 
               shopName.toLowerCase().includes(searchLower) ||
               phone.includes(searchQuery);
      });
      setFiltereredContacts(filtered);
    } else {
      setFiltereredContacts([]);
    }
  }, [searchQuery, contacts]);

  const handleContactSelection = (contact) => {
    const isAlreadySelected = currentSelectedContacts.some(c => c.id === contact.id);
    
    if (isAlreadySelected) {
      setCurrentSelectedContacts(currentSelectedContacts.filter(c => c.id !== contact.id));
    } else {
      setCurrentSelectedContacts([...currentSelectedContacts, contact]);
    }
  };

  const handleSave = () => {
    if (!meetingTitle || !meetingDate || currentSelectedContacts.length === 0) {
      alert('Please fill in all required fields and select at least one contact.');
      return;
    }

    const meetingData = {
      title: meetingTitle,
      date: meetingDate,
      time: meetingTime || '',
      location: meetingLocation,
      notes: meetingNotes,
      attendees: currentSelectedContacts.map(contact => ({
        id: contact.id,
        name: contact.data?.shop_name || contact.data?.Shop_Name || contact.data?.['Shop Name'] || contact.phone,
        phone: contact.phone
      }))
    };

    onSave(meetingData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[100]">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto mx-4">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">Schedule New Meeting</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
        </div>

        <div className="p-6 space-y-6">
          {/* Meeting Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Title *</label>
              <input
                type="text"
                value={meetingTitle}
                onChange={(e) => setMeetingTitle(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g., Product Demo, Contract Discussion"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                <input
                  type="date"
                  value={meetingDate}
                  onChange={(e) => setMeetingDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                <input
                  type="time"
                  value={meetingTime}
                  onChange={(e) => setMeetingTime(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>



            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <input
                type="text"
                value={meetingLocation}
                onChange={(e) => setMeetingLocation(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g., Office, Zoom link, etc."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={meetingNotes}
                onChange={(e) => setMeetingNotes(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                rows="3"
                placeholder="Meeting agenda, things to prepare, etc."
              ></textarea>
            </div>
          </div>

          {/* Contact Selection */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-3">Attendees *</h3>
            
            {/* Selected Contacts */}
            {currentSelectedContacts.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Selected:</h4>
                <div className="flex flex-wrap gap-2">
                  {currentSelectedContacts.map(contact => (
                    <div
                      key={contact.id}
                      className="inline-flex items-center bg-indigo-50 border border-indigo-200 rounded-full px-3 py-1"
                    >
                      <span className="text-sm text-indigo-800">
                        {contact.data?.shop_name || contact.data?.Shop_Name || contact.data?.['Shop Name'] || contact.phone}
                      </span>
                      <button
                        onClick={() => handleContactSelection(contact)}
                        className="ml-2 text-indigo-600 hover:text-indigo-800"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search contacts..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Contact Search Results */}
            {searchQuery && filteredContacts.length > 0 && (
              <div className="max-h-60 overflow-y-auto border rounded-lg divide-y">
                {filteredContacts.map(contact => {
                  const isSelected = currentSelectedContacts.some(c => c.id === contact.id);
                  const shopName = contact.data?.shop_name || contact.data?.Shop_Name || contact.data?.['Shop Name'];
                  const contactName = contact.data?.name || contact.data?.Name;
                  
                  return (
                    <div
                      key={contact.id}
                      onClick={() => handleContactSelection(contact)}
                      className={`p-3 cursor-pointer ${isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
                    >
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          className="mr-3 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                        />
                        <div>
                          {shopName && <p className="font-medium text-gray-800">{shopName}</p>}
                          {contactName && <p className="text-sm text-gray-600">{contactName}</p>}
                          <p className="text-sm text-gray-600">{contact.phone}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {searchQuery && filteredContacts.length === 0 && (
              <div className="text-center py-4 text-gray-500">
                No contacts found matching "{searchQuery}"
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-semibold"
            >
              Schedule Meeting
            </button>
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

// Productivity View (Admin Only)
const ProductivityView = () => {
  const [dateRange, setDateRange] = useState('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [staffData, setStaffData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [selectedMetric, setSelectedMetric] = useState(null);
  const [detailsData, setDetailsData] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const getDateRange = () => {
    const now = new Date();
    let start, end;

    if (dateRange === 'today') {
      start = new Date(now.setHours(0, 0, 0, 0));
      end = new Date(now.setHours(23, 59, 59, 999));
    } else if (dateRange === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      start = new Date(yesterday.setHours(0, 0, 0, 0));
      end = new Date(yesterday.setHours(23, 59, 59, 999));
    } else if (dateRange === 'this_week') {
      const firstDay = now.getDate() - now.getDay();
      start = new Date(now.setDate(firstDay));
      start.setHours(0, 0, 0, 0);
      end = new Date();
    } else if (dateRange === 'this_month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date();
    } else if (dateRange === 'custom') {
      start = customStartDate ? new Date(customStartDate) : new Date();
      end = customEndDate ? new Date(customEndDate) : new Date();
      end.setHours(23, 59, 59, 999);
    }

    return { start: start.toISOString(), end: end.toISOString() };
  };

  const fetchProductivityData = async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange();
      const response = await axios.get(`${API}/productivity/staff-summary`, {
        params: { start_date: start, end_date: end }
      });
      setStaffData(response.data);
    } catch (error) {
      console.error('Failed to fetch productivity data:', error);
      alert('Failed to load productivity data');
    } finally {
      setLoading(false);
    }
  };

  const fetchMetricDetails = async (userId, userName, metric) => {
    setDetailsLoading(true);
    setSelectedStaff(userName);
    setSelectedMetric(metric);
    setShowDetailsModal(true);
    try {
      const { start, end } = getDateRange();
      const response = await axios.get(`${API}/productivity/staff-details`, {
        params: {
          user_id: userId,
          metric_type: metric,
          start_date: start,
          end_date: end
        }
      });
      setDetailsData(response.data.data);
    } catch (error) {
      console.error('Failed to fetch metric details:', error);
      alert('Failed to load details');
    } finally {
      setDetailsLoading(false);
    }
  };

  useEffect(() => {
    fetchProductivityData();
  }, [dateRange, customStartDate, customEndDate]);

  const getMetricLabel = (metric) => {
    const labels = {
      followups: 'Follow-ups',
      demos: 'Demos',
      meetings: 'Meetings',
      calls: 'Fresh Calls'
    };
    return labels[metric] || metric;
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <h2 className="text-3xl font-bold text-gray-800">Staff Productivity</h2>
      </div>

      {/* Date Range Filters */}
      <div className="bg-white rounded-xl shadow-md p-4 mb-6">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setDateRange('today')}
              className={`px-4 py-2 rounded-lg transition font-medium ${
                dateRange === 'today'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              📅 Today
            </button>
            <button
              onClick={() => setDateRange('yesterday')}
              className={`px-4 py-2 rounded-lg transition font-medium ${
                dateRange === 'yesterday'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              📅 Yesterday
            </button>
            <button
              onClick={() => setDateRange('this_week')}
              className={`px-4 py-2 rounded-lg transition font-medium ${
                dateRange === 'this_week'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              📅 This Week
            </button>
            <button
              onClick={() => setDateRange('this_month')}
              className={`px-4 py-2 rounded-lg transition font-medium ${
                dateRange === 'this_month'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              📅 This Month
            </button>
            <button
              onClick={() => setDateRange('custom')}
              className={`px-4 py-2 rounded-lg transition font-medium ${
                dateRange === 'custom'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              📅 Custom Range
            </button>
          </div>

          {dateRange === 'custom' && (
            <div className="flex flex-wrap gap-2 items-center">
              <div>
                <label className="text-sm font-medium text-gray-700 mr-2">From:</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mr-2">To:</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Staff Productivity Table */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-md p-12 text-center">
          <div className="inline-flex items-center">
            <svg className="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="ml-3 text-lg text-gray-600">Loading productivity data...</span>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff Member</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Fresh Calls</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Follow-ups Created</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Follow-ups Completed</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Demos Given</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Demos Watched</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Meetings</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {staffData.map((staff) => (
                  <tr key={staff.user_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{staff.user_name}</div>
                          <div className="text-xs text-gray-500">{staff.user_email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        staff.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {staff.role === 'admin' ? '👑 Admin' : '👤 Staff'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => fetchMetricDetails(staff.user_id, staff.user_name, 'calls')}
                        className="text-lg font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {staff.fresh_calls}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => fetchMetricDetails(staff.user_id, staff.user_name, 'followups')}
                        className="text-lg font-semibold text-green-600 hover:text-green-800 hover:underline"
                      >
                        {staff.followups_created}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="text-lg font-semibold text-teal-600">
                        {staff.followups_completed}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => fetchMetricDetails(staff.user_id, staff.user_name, 'demos')}
                        className="text-lg font-semibold text-orange-600 hover:text-orange-800 hover:underline"
                      >
                        {staff.demos_given}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="text-lg font-semibold text-indigo-600">
                        {staff.demos_watched}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => fetchMetricDetails(staff.user_id, staff.user_name, 'meetings')}
                        className="text-lg font-semibold text-purple-600 hover:text-purple-800 hover:underline"
                      >
                        {staff.meetings_created}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {staffData.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No productivity data available for the selected period.
            </div>
          )}
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">
                {selectedStaff} - {getMetricLabel(selectedMetric)}
              </h2>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                &times;
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
              {detailsLoading ? (
                <div className="text-center py-12">
                  <div className="inline-flex items-center">
                    <svg className="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="ml-3 text-lg text-gray-600">Loading details...</span>
                  </div>
                </div>
              ) : detailsData.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No data available
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedMetric === 'followups' && detailsData.map((item, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">
                            {item.contact?.customer_name || item.contact?.data?.shop_name || 'Unknown'}
                          </p>
                          <p className="text-sm text-gray-600">📞 {item.contact?.phone || 'N/A'}</p>
                          <p className="text-sm text-gray-600">Due: {format12Hour(item.follow_up_date)}</p>
                          {item.notes && <p className="text-sm text-gray-500 mt-1 italic">"{item.notes}"</p>}
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          item.status === 'completed' ? 'bg-green-100 text-green-800' :
                          item.status === 'overdue' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {item.status}
                        </span>
                      </div>
                    </div>
                  ))}

                  {selectedMetric === 'demos' && detailsData.map((item, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">
                            {item.contact?.customer_name || item.contact?.data?.shop_name || 'Unknown'}
                          </p>
                          <p className="text-sm text-gray-600">📞 {item.contact?.phone || 'N/A'}</p>
                          <p className="text-sm text-gray-600">Given: {format12Hour(item.given_at)}</p>
                          {item.notes && <p className="text-sm text-gray-500 mt-1 italic">"{item.notes}"</p>}
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          item.watched ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {item.watched ? '✓ Watched' : 'Not Watched'}
                        </span>
                      </div>
                    </div>
                  ))}

                  {selectedMetric === 'meetings' && detailsData.map((item, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">{item.title}</p>
                          <p className="text-sm text-gray-600">📅 {item.date} {item.time && `at ${item.time}`}</p>
                          {item.location && <p className="text-sm text-gray-600">📍 {item.location}</p>}
                          {item.notes && <p className="text-sm text-gray-500 mt-1 italic">"{item.notes}"</p>}
                          {item.attendees && item.attendees.length > 0 && (
                            <p className="text-sm text-gray-600 mt-1">
                              👥 {item.attendees.length} attendee(s)
                            </p>
                          )}
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          item.status === 'completed' ? 'bg-green-100 text-green-800' :
                          item.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {item.status}
                        </span>
                      </div>
                    </div>
                  ))}

                  {selectedMetric === 'calls' && detailsData.map((item, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">
                            {item.contact?.customer_name || item.contact?.data?.shop_name || item.contact?.data?.Shop_Name || 'Unknown Customer'}
                          </p>
                          <p className="text-sm text-gray-600">📞 {item.contact?.phone || item.target || 'N/A'}</p>
                          <p className="text-sm text-gray-600">Time: {format12Hour(item.timestamp)}</p>
                          {item.contact?.data?.shop_name && item.contact.customer_name && (
                            <p className="text-sm text-gray-500 mt-1">🏪 {item.contact.data.shop_name}</p>
                          )}
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          item.contact?.status === 'Called' ? 'bg-blue-100 text-blue-800' :
                          item.contact?.status === 'Follow Up' ? 'bg-yellow-100 text-yellow-800' :
                          item.contact?.status === 'Interested' ? 'bg-green-100 text-green-800' :
                          item.contact?.status === 'Not Interested' ? 'bg-red-100 text-red-800' :
                          item.contact?.status === 'Closed' ? 'bg-purple-100 text-purple-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {item.contact?.status || 'Unknown'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Users Management View (Admin Only)
const UsersView = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/users`);
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      alert('Failed to load users');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchUsers();
  }, []);
  
  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    
    try {
      await axios.delete(`${API}/users/${userId}`);
      alert('User deleted successfully');
      fetchUsers();
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to delete user');
    }
  };
  
  const handleUpdateRole = async (userId, newRole) => {
    try {
      await axios.put(`${API}/users/${userId}/role`, { role: newRole });
      alert('User role updated successfully');
      fetchUsers();
      setShowRoleModal(false);
      setSelectedUser(null);
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to update role');
    }
  };
  
  const getRoleBadgeColor = (role) => {
    switch(role) {
      case 'admin': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'staff': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }
  
  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <h2 className="text-2xl lg:text-3xl font-bold text-gray-800">User Management</h2>
        <button
          onClick={() => {
            setSelectedUser(null);
            setShowUserModal(true);
          }}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-semibold touch-manipulation"
        >
          + Add User
        </button>
      </div>
      
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map(user => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{user.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${getRoleBadgeColor(user.role)}`}>
                      {user.role === 'admin' ? '👑 Admin' : '👤 Staff'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format12Hour(user.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => {
                        setSelectedUser(user);
                        setShowRoleModal(true);
                      }}
                      className="text-indigo-600 hover:text-indigo-900 mr-4"
                    >
                      Change Role
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {users.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No users found. Add users to get started.
          </div>
        )}
      </div>
      
      {/* Create User Modal */}
      {showUserModal && (
        <UserFormModal
          onClose={() => setShowUserModal(false)}
          onSave={async (userData) => {
            try {
              await axios.post(`${API}/users`, userData);
              alert('User created successfully');
              fetchUsers();
              setShowUserModal(false);
            } catch (error) {
              alert(error.response?.data?.detail || 'Failed to create user');
            }
          }}
        />
      )}
      
      {/* Change Role Modal */}
      {showRoleModal && selectedUser && (
        <RoleChangeModal
          user={selectedUser}
          onClose={() => {
            setShowRoleModal(false);
            setSelectedUser(null);
          }}
          onSave={(newRole) => handleUpdateRole(selectedUser.id, newRole)}
        />
      )}
    </div>
  );
};

// User Form Modal
const UserFormModal = ({ onClose, onSave }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('staff');
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  
  const validate = () => {
    const newErrors = {};
    if (!email.trim()) newErrors.email = 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = 'Invalid email format';
    if (!password.trim()) newErrors.password = 'Password is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      onSave({ email, password, role });
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-800">Create New User</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 ${
                errors.email ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="user@example.com"
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full px-3 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-indigo-500 ${
                  errors.password ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="staff">👤 Staff</option>
              <option value="admin">👑 Admin</option>
            </select>
          </div>
          
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-semibold"
            >
              Create User
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Role Change Modal
const RoleChangeModal = ({ user, onClose, onSave }) => {
  const [selectedRole, setSelectedRole] = useState(user.role);
  
  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(selectedRole);
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-800">Change User Role</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>
        
        <div className="mb-4">
          <p className="text-sm text-gray-600">User: <span className="font-medium text-gray-800">{user.email}</span></p>
          <p className="text-sm text-gray-600 mt-1">Current Role: <span className={`font-medium ${
            user.role === 'admin' ? 'text-purple-600' : 'text-blue-600'
          }`}>{user.role === 'admin' ? '👑 Admin' : '👤 Staff'}</span></p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">New Role</label>
            <div className="space-y-2">
              <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  value="staff"
                  checked={selectedRole === 'staff'}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="mr-3"
                />
                <div>
                  <div className="font-medium">👤 Staff</div>
                  <div className="text-xs text-gray-500">Can manage contacts, follow-ups, and meetings</div>
                </div>
              </label>
              <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  value="admin"
                  checked={selectedRole === 'admin'}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="mr-3"
                />
                <div>
                  <div className="font-medium">👑 Admin</div>
                  <div className="text-xs text-gray-500">Full access including user management</div>
                </div>
              </label>
            </div>
          </div>
          
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-semibold"
              disabled={selectedRole === user.role}
            >
              Update Role
            </button>
          </div>
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