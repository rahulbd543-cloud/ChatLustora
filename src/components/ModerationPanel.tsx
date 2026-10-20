import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.js';
import { ReportItem, ModerationAuditLog } from '../../shared/types.js';
import {
  ShieldAlert,
  AlertOctagon,
  Clock,
  Slash,
  CheckCircle,
  FileText,
  UserCheck
} from 'lucide-react';

export const ModerationPanel: React.FC = () => {
  const { session, t } = useApp();

  const [reports, setReports] = useState<ReportItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<ModerationAuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchModerationData = async () => {
    if (!session) return;

    setLoading(true);
    setLoadError(null);

    try {
      const [reportsResponse, logsResponse] = await Promise.all([
        fetch('/api/moderation/reports', {
          credentials: 'same-origin'
        }),
        fetch('/api/moderation/audit-logs', {
          credentials: 'same-origin'
        })
      ]);

      if (!reportsResponse.ok || !logsResponse.ok) {
        if (reportsResponse.status === 401 || logsResponse.status === 401) {
          throw new Error('Your session has expired. Please sign in again.');
        }

        if (reportsResponse.status === 403 || logsResponse.status === 403) {
          throw new Error('You are not authorized to view moderation data.');
        }

        throw new Error('Unable to load moderation data. Please try again.');
      }

      const reportsData = await reportsResponse.json();
      const logsData = await logsResponse.json();

      if (!Array.isArray(reportsData.reports) || !Array.isArray(logsData.logs)) {
        throw new Error('The moderation API returned an invalid response.');
      }

      setReports(reportsData.reports);
      setAuditLogs(logsData.logs);
    } catch (error) {
      setReports([]);
      setAuditLogs([]);
      setLoadError(
        error instanceof Error
          ? error.message
          : 'Unable to load moderation data. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchModerationData();
  }, [session?.token]);

  
  const handleAction = async (
    action: 'warn' | 'mute' | 'ban' | 'dismiss',
    report: ReportItem
  ) => {
    setLoadError(null);

    const confirmation = window.confirm(
      `${action.toUpperCase()} ${report.targetNickname} for this report?`
    );

    if (!confirmation) return;

    try {
      const response = await fetch('/api/moderation/action', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reportId: report.id,
          action
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.error === 'string'
            ? data.error
            : 'Moderation action failed.'
        );
      }

      await fetchModerationData();
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : 'Moderation action failed.'
      );
    }
  };
  if (session?.role !== 'admin' && session?.role !== 'moderator') {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center text-text-muted">
        <p>Access restricted to ChatLustora moderators and administrators.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-4 sm:p-6 lg:p-8 bg-raised/40">
      <div className="max-w-5xl mx-auto w-full flex flex-col gap-6">
        <div>
          <h2 className="text-2xl font-extrabold text-text-main flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-brand" />
            <span>{t('reportsQueue')}</span>
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Real-time report triage and moderation enforcement. Review abusive conduct, non-consensual content, and underage suspicion.
          </p>
        </div>

        {loadError && (
          <div role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-500">
            {loadError}
          </div>
        )}

        {/* Reports Queue */}
        <div className="flex flex-col gap-3">
          {reports.length === 0 ? (
            <div className="p-8 rounded-2xl bg-raised border border-line text-center text-xs text-text-muted">
              No pending reports in the queue. All community spaces are clean!
            </div>
          ) : (
            reports.map(rep => (
              <div
                key={rep.id}
                className="p-4 rounded-xl bg-raised border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-500 text-[10px] font-bold uppercase">
                      {rep.reason}
                    </span>
                    <span className="text-xs text-text-muted">
                      Reported by <strong className="text-text-main">{rep.reporterNickname}</strong>
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-text-main mt-1">
                    Target: <span className="text-brand">{rep.targetNickname}</span>
                  </p>
                  {rep.notes && (
                    <p className="text-xs text-text-muted italic">
                      "{rep.notes}"
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleAction('warn', rep)}
                    className="px-3 py-1.5 rounded-lg border border-line hover:border-amber-500 text-xs font-semibold text-amber-500"
                  >
                    {t('warnUser')}
                  </button>
                  <button
                    onClick={() => handleAction('mute', rep)}
                    className="px-3 py-1.5 rounded-lg border border-line hover:border-orange-500 text-xs font-semibold text-orange-500"
                  >
                    {t('muteUser')}
                  </button>
                  <button
                    onClick={() => handleAction('ban', rep)}
                    className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-bold hover:bg-red-600"
                  >
                    {t('banUser')}
                  </button>
                 <button
  onClick={() => handleAction('dismiss', rep)}
  className="px-3 py-1.5 rounded-lg border border-line text-xs font-semibold"
>
  Dismiss
</button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Audit Logs */}
        <div className="flex flex-col gap-3 mt-4">
          <h3 className="text-base font-bold text-text-main flex items-center gap-2">
            <FileText className="w-4 h-4 text-brand" />
            <span>{t('auditLogs')}</span>
          </h3>

          <div className="rounded-xl border border-line bg-raised overflow-hidden">
            {auditLogs.length === 0 ? (
              <div className="p-4 text-center text-xs text-text-muted">
                No moderation logs recorded yet.
              </div>
            ) : (
              auditLogs.map(log => (
                <div
                  key={log.id}
                  className="p-3 border-b border-line last:border-b-0 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-brand">{log.moderatorNickname}</span>
                    <span className="text-text-muted">performed</span>
                    <span className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 font-mono uppercase text-[10px]">
                      {log.action}
                    </span>
                    <span className="text-text-muted">on</span>
                    <span className="font-bold text-text-main">{log.targetNickname}</span>
                  </div>
                  <span className="text-text-muted text-[10px]">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
