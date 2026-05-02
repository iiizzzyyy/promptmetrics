"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, AuditLogEntry } from "@/lib/api";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { ClipboardList, Download, Calendar } from "lucide-react";

const LIMIT = 20;

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

function formatDateInput(ts: number): string {
  const d = new Date(ts * 1000);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildDetails(entry: AuditLogEntry): string {
  if (entry.prompt_name) {
    return entry.version_tag
      ? `${entry.prompt_name}@${entry.version_tag}`
      : entry.prompt_name;
  }
  if (entry.ip_address) {
    return `IP: ${entry.ip_address}`;
  }
  return "—";
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const params = useMemo(() => {
    const p: { page?: number; limit?: number; startDate?: string; endDate?: string } = {
      page,
      limit: LIMIT,
    };
    if (startDate) p.startDate = startDate;
    if (endDate) p.endDate = endDate;
    return p;
  }, [page, startDate, endDate]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["audit-logs", params],
    queryFn: () => api.getAuditLogs(params),
  });

  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    if (actionFilter === "all") return data.items;
    return data.items.filter((item) => item.action === actionFilter);
  }, [data, actionFilter]);

  const actionOptions = useMemo(() => {
    if (!data?.items) return [];
    return Array.from(new Set(data.items.map((i) => i.action)));
  }, [data]);

  const handleExport = () => {
    const rows: string[][] = [
      ["Timestamp", "Action", "User", "Workspace", "Details"],
    ];
    filteredItems.forEach((item) => {
      rows.push([
        formatDate(item.timestamp),
        item.action,
        item.api_key_name,
        item.workspace_id || "default",
        buildDetails(item),
      ]);
    });
    downloadCsv(`audit-logs-${formatDateInput(Math.floor(Date.now() / 1000))}.csv`, rows);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="pm-h3">Audit Log Explorer</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={!data || filteredItems.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-sm text-muted-foreground">Start Date</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-sm text-muted-foreground">End Date</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-sm text-muted-foreground">Action</label>
                <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(1); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    {actionOptions.map((action) => (
                      <SelectItem key={action} value={action}>
                        {action}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            Failed to load audit logs: {error.message}
          </div>
        )}

        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Workspace</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: LIMIT }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No audit logs found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item: AuditLogEntry) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {formatDate(item.timestamp)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {item.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{item.api_key_name}</TableCell>
                      <TableCell className="text-muted-foreground">{item.workspace_id || "default"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[240px] truncate">
                        {buildDetails(item)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {data.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={page >= data.totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
