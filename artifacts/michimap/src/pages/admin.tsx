import { useGetMe, useGetAdminStats, useGetAdminUsers, useGetAdminGenerations } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { Layout } from "@/components/layout";
import { Loader2, Users, FileSpreadsheet, Download, Activity } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function AdminDashboard() {
  const { data: user, isLoading: isUserLoading } = useGetMe();
  const [, setLocation] = useLocation();

  const { data: stats, isLoading: isStatsLoading } = useGetAdminStats({
    query: { enabled: !!user?.isAdmin },
  });

  const [userPage, setUserPage] = useState(1);
  const { data: usersData, isLoading: isUsersLoading } = useGetAdminUsers(
    { page: userPage, limit: 15 },
    { query: { enabled: !!user?.isAdmin } }
  );

  const [genPage, setGenPage] = useState(1);
  const { data: genData, isLoading: isGenLoading } = useGetAdminGenerations(
    { page: genPage, limit: 15 },
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

  // Build simple bar data for transition paths
  const pathCounts = stats ? stats.generationsByTransitionPath : {};
  const pathTotal = Object.values(pathCounts).reduce((s: number, v: any) => s + Number(v), 0) || 1;

  const modelCounts = stats ? stats.generationsByModel : {};

  return (
    <Layout>
      <div className="max-w-screen-xl mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Traffic Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Usage analytics and user demographics.</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
          </div>
        ) : stats ? (
          <>
            {/* STAT CARDS */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Total Users", value: stats.totalUsers, icon: Users, color: "text-blue-500 bg-blue-50" },
                { label: "Plans Generated", value: stats.totalGenerations, icon: FileSpreadsheet, color: "text-green-600 bg-green-50" },
                { label: "Downloads", value: stats.totalDownloads, icon: Download, color: "text-primary bg-primary/10" },
                { label: "Today", value: stats.generationsToday, icon: Activity, color: "text-purple-500 bg-purple-50" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="bg-card border border-border rounded-xl p-5 flex items-center gap-3 shadow-sm">
                  <div className={`p-2 rounded-lg ${color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{label}</p>
                    <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* SIMPLE BREAKDOWN BARS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* By Transition Path */}
              <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                <h3 className="text-sm font-bold text-foreground mb-4">Generations by Transition Path</h3>
                <div className="space-y-3">
                  {Object.entries(pathCounts).map(([name, val]) => {
                    const pct = Math.round((Number(val) / pathTotal) * 100);
                    const colors: Record<string, string> = { greenfield: "bg-green-500", brownfield: "bg-amber-500", bluefield: "bg-blue-500" };
                    return (
                      <div key={name}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium text-foreground capitalize">{name}</span>
                          <span className="text-muted-foreground">{Number(val)} ({pct}%)</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${colors[name] || "bg-primary"}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  {Object.keys(pathCounts).length === 0 && (
                    <p className="text-xs text-muted-foreground italic">No data yet</p>
                  )}
                </div>
              </div>

              {/* By AI Model */}
              <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                <h3 className="text-sm font-bold text-foreground mb-4">Generations by AI Model</h3>
                <div className="space-y-3">
                  {(() => {
                    const modelTotal = Object.values(modelCounts).reduce((s: number, v: any) => s + Number(v), 0) || 1;
                    return Object.entries(modelCounts).map(([name, val]) => {
                      const pct = Math.round((Number(val) / modelTotal) * 100);
                      return (
                        <div key={name}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-medium text-foreground">{name}</span>
                            <span className="text-muted-foreground">{Number(val)} ({pct}%)</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    });
                  })()}
                  {Object.keys(modelCounts).length === 0 && (
                    <p className="text-xs text-muted-foreground italic">No data yet</p>
                  )}
                </div>
              </div>
            </div>

            {/* TABLES */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Users */}
              <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col">
                <div className="px-5 py-4 border-b border-border flex justify-between items-center">
                  <h3 className="font-bold text-foreground text-sm">Users</h3>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {usersData?.total || 0} total
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="text-muted-foreground uppercase bg-muted/30">
                      <tr>
                        <th className="px-4 py-2.5 font-medium">User</th>
                        <th className="px-4 py-2.5 font-medium">Via</th>
                        <th className="px-4 py-2.5 font-medium text-center">Plans</th>
                        <th className="px-4 py-2.5 font-medium text-center">DLs</th>
                        <th className="px-4 py-2.5 font-medium">Joined</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {usersData?.users.map(u => (
                        <tr key={u.id} className="hover:bg-muted/10">
                          <td className="px-4 py-3">
                            <div className="font-medium text-foreground">{u.name}</div>
                            <div className="text-muted-foreground text-[10px]">{u.email}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="capitalize text-muted-foreground">{u.provider}</span>
                          </td>
                          <td className="px-4 py-3 text-center font-mono">{u.generationCount}</td>
                          <td className="px-4 py-3 text-center font-mono">{u.downloadCount}</td>
                          <td className="px-4 py-3 text-muted-foreground">{formatDate(u.createdAt)}</td>
                        </tr>
                      ))}
                      {!usersData?.users?.length && (
                        <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground italic">No users yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-2.5 border-t border-border flex justify-between items-center bg-muted/10">
                  <button disabled={userPage === 1} onClick={() => setUserPage(p => p - 1)}
                    className="text-xs px-3 py-1 border border-border rounded-lg bg-card hover:bg-muted disabled:opacity-40">
                    Previous
                  </button>
                  <span className="text-xs text-muted-foreground">Page {userPage}</span>
                  <button disabled={!usersData || userPage * 15 >= usersData.total} onClick={() => setUserPage(p => p + 1)}
                    className="text-xs px-3 py-1 border border-border rounded-lg bg-card hover:bg-muted disabled:opacity-40">
                    Next
                  </button>
                </div>
              </div>

              {/* Generations */}
              <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col">
                <div className="px-5 py-4 border-b border-border flex justify-between items-center">
                  <h3 className="font-bold text-foreground text-sm">Recent Generations</h3>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {genData?.total || 0} total
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="text-muted-foreground uppercase bg-muted/30">
                      <tr>
                        <th className="px-4 py-2.5 font-medium">Path</th>
                        <th className="px-4 py-2.5 font-medium">Name</th>
                        <th className="px-4 py-2.5 font-medium">Email</th>
                        <th className="px-4 py-2.5 font-medium">Model</th>
                        <th className="px-4 py-2.5 font-medium">Location</th>
                        <th className="px-4 py-2.5 font-medium">Device</th>
                        <th className="px-4 py-2.5 font-medium text-center">Sent</th>
                        <th className="px-4 py-2.5 font-medium text-center">Downloaded</th>
                        <th className="px-4 py-2.5 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {genData?.generations.map((g: any) => (
                        <tr key={g.id} className="hover:bg-muted/10">
                          <td className="px-4 py-3">
                            <span className="capitalize font-medium text-foreground">{g.transitionPath}</span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground max-w-[80px] truncate" title={g.visitorName || ""}>
                            {g.visitorName || <em className="text-muted-foreground/50">-</em>}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground max-w-[120px] truncate" title={g.visitorEmail || ""}>
                            {g.visitorEmail || <em className="text-muted-foreground/50">-</em>}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{g.aiModel}</td>
                          <td className="px-4 py-3 text-muted-foreground max-w-[100px] truncate" title={g.location || ""}>{g.location || "-"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{g.device || "-"}</td>
                          <td className="px-4 py-3 text-center">
                            {g.emailSent ? <span className="text-primary font-bold">Yes</span> : <span className="text-muted-foreground">No</span>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {g.downloaded ? <span className="text-green-500 font-bold">Yes</span> : <span className="text-muted-foreground">No</span>}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{formatDate(g.createdAt)}</td>
                        </tr>
                      ))}
                      {!genData?.generations?.length && (
                        <tr><td colSpan={9} className="px-4 py-6 text-center text-muted-foreground italic">No generations yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-2.5 border-t border-border flex justify-between items-center bg-muted/10">
                  <button disabled={genPage === 1} onClick={() => setGenPage(p => p - 1)}
                    className="text-xs px-3 py-1 border border-border rounded-lg bg-card hover:bg-muted disabled:opacity-40">
                    Previous
                  </button>
                  <span className="text-xs text-muted-foreground">Page {genPage}</span>
                  <button disabled={!genData || genPage * 15 >= genData.total} onClick={() => setGenPage(p => p + 1)}
                    className="text-xs px-3 py-1 border border-border rounded-lg bg-card hover:bg-muted disabled:opacity-40">
                    Next
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </Layout>
  );
}
