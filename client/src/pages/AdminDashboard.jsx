import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Users, TrendingUp, BarChart3, ArrowLeft, Mail, Calendar } from 'lucide-react';
import { adminAPI } from '../services/apiClient';
import { useAuth } from '../context/AuthContext';

const AdminDashboard = () => {
    const [stats, setStats] = useState(null);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();

    useEffect(() => {
        loadAdminData();
    }, []);

    const loadAdminData = async () => {
        try {
            const [statsRes, usersRes] = await Promise.all([
                adminAPI.getStats(),
                adminAPI.getAllUsers()
            ]);
            setStats(statsRes.data.stats);
            setUsers(usersRes.data.users);
        } catch (error) {
            console.error('Failed to load admin data:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    return (
        <div className="relative isolate overflow-hidden bg-black min-h-screen">
            {/* Animated Background */}
            <div className="absolute inset-0 -z-10">
                <div className="absolute inset-0 bg-gradient-to-b from-black via-slate-950 to-black" />
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-orange-500/20 rounded-full blur-[120px] animate-pulse" />
            </div>

            <div className="relative mx-auto max-w-7xl px-6 py-12">
                {/* Header */}
                <div className="mb-8">
                    <Link to="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-orange-400 transition-colors mb-4">
                        <ArrowLeft className="w-4 h-4" />
                        Back to Home
                    </Link>
                    <div className="flex items-center gap-3 mb-2">
                        <Shield className="w-8 h-8 text-orange-400" />
                        <h1 className="text-4xl font-bold text-white">Admin Dashboard</h1>
                    </div>
                    <p className="text-slate-400">
                        Logged in as: <span className="text-orange-400">{user?.email}</span> (Admin)
                    </p>
                </div>

                {loading && (
                    <div className="text-center py-12">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div>
                        <p className="text-slate-400 mt-4">Loading dashboard...</p>
                    </div>
                )}

                {!loading && (
                    <>
                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            <StatCard
                                icon={<Users className="w-6 h-6 text-orange-400" />}
                                label="Total Users"
                                value={stats?.total_users || 0}
                                color="orange"
                            />
                            <StatCard
                                icon={<BarChart3 className="w-6 h-6 text-blue-400" />}
                                label="Total Interviews"
                                value={stats?.total_interviews || 0}
                                color="blue"
                            />
                            <StatCard
                                icon={<TrendingUp className="w-6 h-6 text-green-400" />}
                                label="Average Score"
                                value={`${stats?.average_score || 0}%`}
                                color="green"
                            />
                        </div>

                        {/* Users Table */}
                        <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-800 overflow-hidden">
                            <div className="p-6 border-b border-slate-800">
                                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                    <Users className="w-6 h-6 text-orange-400" />
                                    Registered Users
                                </h2>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-slate-800/50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                                                Email
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                                                Role
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                                                Joined
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {users.map((user) => (
                                            <tr key={user.id} className="hover:bg-slate-800/30 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <Mail className="w-4 h-4 text-slate-500" />
                                                        <span className="text-white">{user.email}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {user.is_admin ? (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20">
                                                            Admin
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-700/50 text-slate-400">
                                                            User
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-2 text-slate-400">
                                                        <Calendar className="w-4 h-4" />
                                                        {formatDate(user.created_at)}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {users.length === 0 && (
                                <div className="p-12 text-center">
                                    <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                                    <p className="text-slate-400">No users registered yet</p>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

const StatCard = ({ icon, label, value, color }) => {
    const colorClasses = {
        orange: 'from-orange-500/10 to-orange-500/5 border-orange-500/20',
        blue: 'from-blue-500/10 to-blue-500/5 border-blue-500/20',
        green: 'from-green-500/10 to-green-500/5 border-green-500/20'
    };

    return (
        <div className={`bg-gradient-to-br ${colorClasses[color]} backdrop-blur-sm p-6 rounded-2xl border`}>
            <div className="flex items-center justify-between mb-4">
                <div className="bg-slate-800/50 w-12 h-12 rounded-xl flex items-center justify-center">
                    {icon}
                </div>
            </div>
            <p className="text-slate-400 text-sm mb-1">{label}</p>
            <p className="text-3xl font-bold text-white">{value}</p>
        </div>
    );
};

export default AdminDashboard;
