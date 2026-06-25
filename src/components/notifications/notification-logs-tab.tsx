"use client";

import { useNotificationLogs } from "@/lib/queries";
import { formatDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

export function NotificationLogsTab() {
  const { data, isLoading } = useNotificationLogs();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <Table>
          <THead>
            <TR>
              <TH>Status</TH>
              <TH>Event</TH>
              <TH>Recipient</TH>
              <TH>Subject</TH>
              <TH>When</TH>
            </TR>
          </THead>
          <TBody>
            {(data ?? []).map((l) => (
              <TR key={l.id}>
                <TD>
                  {l.status === "sent" && <Badge variant="success">Sent</Badge>}
                  {l.status === "queued" && <Badge variant="secondary">Queued</Badge>}
                  {l.status === "failed" && <Badge variant="destructive">Failed</Badge>}
                  {l.status === "skipped" && <Badge variant="outline">Skipped</Badge>}
                </TD>
                <TD>
                  <code className="text-xs">{l.event_key}</code>
                </TD>
                <TD className="text-xs">{l.recipient}</TD>
                <TD className="max-w-md truncate text-xs">
                  {l.subject}
                  {l.error && <p className="mt-0.5 truncate text-[10px] text-destructive">{l.error}</p>}
                </TD>
                <TD className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(l.created_at)}</TD>
              </TR>
            ))}
            {(!data || data.length === 0) && (
              <TR>
                <TD className="py-6 text-center text-xs text-muted-foreground">No notifications sent yet.</TD>
                <TD></TD><TD></TD><TD></TD><TD></TD>
              </TR>
            )}
          </TBody>
        </Table>
      </CardContent>
    </Card>
  );
}
