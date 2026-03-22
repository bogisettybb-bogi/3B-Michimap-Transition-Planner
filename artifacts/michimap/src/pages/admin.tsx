import { useGetMe, useGetAdminStats, useGetAdminUsers, useGetAdminGenerations } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { Layout } from "@/components/layout";
import { Loader2, Users, FileSpreadsheet, Download, Activity, Search } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { formatDate } from "@/lib/utils";

const COLORS = ['#C8941A', '#0F1117', '#4285F4', '#34A853', '#EA4335'];

export default function AdminDashboard() {
  const { data: user, isLoading: isUserLoading } = useGetMe();
  const [, setLocation] = useLocation();

  const { data: stats, isLoading: isStatsLoading } = useGetAdminStats({
    query: { enabled: !!user?.isAdmin }
  });

  const [userPage, setUserPage] = useState(1);
  const { data: usersData, isLoading: isUsersLoading } = useGetAdminUsers(
    { page: userPage, limit: 10 },
    { query: { enabled: !!user?.isAdmin } }
  );

  const [genPage, setGenPage] = useState(1);
  const { data: genData, isLoading: isGenLoading } = useGetAdminGenerations(
    { page: genPage, limit: 10 },
    { query: { enabled: !!user?.isAdmin } }
  );

  useEffect(() => {
    if (!isUserLoading && (!user || !user.isAdmin)) {
      setLocation("/");
    }
  }, [user, isUserLoading, setLocation]);

  if (isUserLoading || !user?.isAdmin) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  const isLoading = isStatsLoading || isUsersLoading || isGenLoading;

  const pieDataPath = stats ? Object.entries(stats.generationsByTransitionPath).map(([name, value]) => ({ name, value })) : [];
  const pieDataModel = stats ? Object.entries(stats.generationsByModel).map(([name, value]) => ({ name, value })) : [];

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">Platform analytics and user management.</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : stats ? (
          <>
            {/* STATS CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-card p-6 rounded-2xl border border-border shadow-sm flex items-center gap-4">
                <div className="bg-blue-500/10 p-3 rounded-xl text-blue-600"><Users className="w-6 h-6" /></div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                  <h3 className="text-2xl font-bold font-display">{stats.totalUsers}</h3>
                </div>
              </div>
              <div className="bg-card p-6 rounded-2xl border border-border shadow-sm flex items-center gap-4">
                <div className="bg-emerald-500/10 p-3 rounded-xl text-emerald-600"><FileSpreadsheet className="w-6 h-6" /></div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Plans Generated</p>
                  <h3 className="text-2xl font-bold font-display">{stats.totalGenerations}</h3>
                </div>
              </div>
              <div className="bg-card p-6 rounded-2xl border border-border shadow-sm flex items-center gap-4">
                <div className="bg-primary/10 p-3 rounded-xl text-primary"><Download className="w-6 h-6" /></div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Downloads</p>
                  <h3 className="text-2xl font-bold font-display">{stats.totalDownloads}</h3>
                </div>
              </div>
              <div className="bg-card p-6 rounded-2xl border border-border shadow-sm flex items-center gap-4">
                <div className="bg-purple-500/10 p-3 rounded-xl text-purple-600"><Activity className="w-6 h-6" /></div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Generated Today</p>
                  <h3 className="text-2xl font-bold font-display">{stats.generationsToday}</h3>
                </div>
              </div>
            </div>

            {/* CHARTS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
                <h3 className="text-lg font-bold font-display mb-6">Weekly Generations</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.weeklyGenerations}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip cursor={{ fill: 'hsl(var(--muted)/0.5)' }} contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }} />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
                <h3 className="text-lg font-bold font-display mb-6">Usage Breakdown</h3>
                <div className="flex h-64">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-center text-muted-foreground mb-2">By Path</p>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieDataPath} innerRadius={40} outerRadius={70} paddingAngle={2} dataKey="value">
                          {pieDataPath.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-center text-muted-foreground mb-2">By Model</p>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieDataModel} innerRadius={40} outerRadius={70} paddingAngle={2} dataKey="value">
                          {pieDataModel.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>

            {/* TABLES */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Users Table */}
              <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col">
                <div className="p-5 border-b border-border flex justify-between items-center bg-muted/20">
                  <h3 className="font-bold font-display">Recent Users</h3>
                  <span className="text-xs font-medium text-muted-foreground px-2 py-1 bg-muted rounded-full">Total: {usersData?.total || 0}</span>
                </div>
                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground uppercase bg-muted/30">
                      <tr>
                        <th className="px-4 py-3 font-medium">User</th>
                        <th className="px-4 py-3 font-medium text-center">Gens</th>
                        <th className="px-4 py-3 font-medium text-center">Downs</th>
                        <th className="px-4 py-3 font-medium">Joined</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {usersData?.users.map(u => (
                        <tr key={u.id} className="hover:bg-muted/10">
                          <td className="px-4 py-3">
                            <div className="font-medium text-foreground">{u.name}</div>
                            <div className="text-xs text-muted-foreground">{u.email}</div>
                          </td>
                          <td className="px-4 py-3 text-center font-mono">{u.generationCount}</td>
                          <td className="px-4 py-3 text-center font-mono">{u.downloadCount}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(u.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="p-3 border-t border-border flex justify-between items-center bg-muted/10">
                  <button 
                    disabled={userPage === 1}
                    onClick={() => setUserPage(p => p - 1)}
                    className="text-xs px-3 py-1.5 border border-border rounded-lg bg-card hover:bg-muted disabled:opacity-50"
                  >Previous</button>
                  <span className="text-xs text-muted-foreground">Page {userPage}</span>
                  <button 
                    disabled={!usersData || userPage * 10 >= usersData.total}
                    onClick={() => setUserPage(p => p + 1)}
                    className="text-xs px-3 py-1.5 border border-border rounded-lg bg-card hover:bg-muted disabled:opacity-50"
                  >Next</button>
                </div>
              </div>

              {/* Generations Table */}
              <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col">
                <div className="p-5 border-b border-border flex justify-between items-center bg-muted/20">
                  <h3 className="font-bold font-display">Recent Generations</h3>
                  <span className="text-xs font-medium text-muted-foreground px-2 py-1 bg-muted rounded-full">Total: {genData?.total || 0}</span>
                </div>
                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground uppercase bg-muted/30">
                      <tr>
                        <th className="px-4 py-3 font-medium">Path / Model</th>
                        <th className="px-4 py-3 font-medium">User</th>
                        <th className="px-4 py-3 font-medium text-center">DL'd</th>
                        <th className="px-4 py-3 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {genData?.generations.map(g => (
                        <tr key={g.id} className="hover:bg-muted/10">
                          <td className="px-4 py-3">
                            <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary uppercase mb-1">{g.transitionPath}</span>
                            <div className="text-xs text-muted-foreground">{g.aiModel}</div>
                          </td>
                          <td className="px-4 py-3">
                            {g.userEmail ? (
                              <div className="text-xs truncate max-w-[120px]" title={g.userEmail}>{g.userEmail}</div>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">Guest</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {g.downloaded ? <span className="text-emerald-500 font-bold">✓</span> : <span className="text-muted-foreground">-</span>}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(g.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="p-3 border-t border-border flex justify-between items-center bg-muted/10">
                  <button 
                    disabled={genPage === 1}
                    onClick={() => setGenPage(p => p - 1)}
                    className="text-xs px-3 py-1.5 border border-border rounded-lg bg-card hover:bg-muted disabled:opacity-50"
                  >Previous</button>
                  <span className="text-xs text-muted-foreground">Page {genPage}</span>
                  <button 
                    disabled={!genData || genPage * 10 >= genData.total}
                    onClick={() => setGenPage(p => p + 1)}
                    className="text-xs px-3 py-1.5 border border-border rounded-lg bg-card hover:bg-muted disabled:opacity-50"
                  >Next</button>
                </div>
              </div>

            </div>
          </>
        ) : null}
      </div>
    </Layout>
  );
}
