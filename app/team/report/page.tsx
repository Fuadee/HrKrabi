'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

type Profile = {
  id: string;
  role: string | null;
  team_id: string | null;
};

type Worker = {
  id: string;
  full_name: string;
  team_id: string | null;
  team?: {
    name: string | null;
  } | null;
};

const DEV_MODE = process.env.NODE_ENV === 'development';

export default function TeamReportPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const workerCount = useMemo(() => workers.length, [workers]);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setLoading(true);
      const { data: userData, error: userError } = await supabaseBrowser.auth.getUser();

      if (userError) {
        console.error('Auth error:', userError.message);
      }

      if (!userData.user) {
        router.replace('/login');
        return;
      }

      if (!isMounted) return;

      setUserId(userData.user.id);

      const { data: profileData, error: profileLoadError } = await supabaseBrowser
        .from('profiles')
        .select('id, role, team_id')
        .eq('id', userData.user.id)
        .single();

      if (profileLoadError) {
        console.error('Profile load error:', profileLoadError.message);
      }

      if (!profileData) {
        setProfileError('Profile not found. Contact admin.');
        setLoading(false);
        return;
      }

      console.log('user.id', userData.user.id);
      console.log('profile.role', profileData.role);
      console.log('profile.team_id', profileData.team_id);

      setProfile(profileData);

      if (!profileData.team_id) {
        setWorkers([]);
        setLoading(false);
        return;
      }

      // The previous page used a server-side service role query without binding to the user.
      // If the service key was missing or RLS blocked access, workers could appear empty.
      // This query guarantees visibility by using the logged-in user's team_id.
      const { data: workerData, error: workerError } = await supabaseBrowser
        .from('workers')
        .select('id, full_name, team_id, team:teams(name)')
        .eq('team_id', profileData.team_id)
        .order('full_name');

      if (workerError) {
        console.error('Worker query failed', {
          code: workerError.code,
          message: workerError.message,
        });
      }

      if (workerError && (workerError.status === 401 || workerError.status === 403)) {
        if (DEV_MODE) {
          // DEV ONLY: use service role for debugging RLS issues.
          console.warn('RLS bypass used for development debugging');
          const response = await fetch(`/api/dev/workers?team_id=${profileData.team_id}`);
          if (response.ok) {
            const fallbackData = (await response.json()) as { workers: Worker[] };
            if (!isMounted) return;
            setWorkers(fallbackData.workers ?? []);
          } else {
            console.error('RLS fallback failed with status', response.status);
          }
        }
      } else {
        if (!isMounted) return;
        setWorkers(workerData ?? []);
      }

      if (!workerError && (workerData?.length ?? 0) === 0) {
        console.log(`No workers found for team_id=${profileData.team_id}`);
      }

      if (isMounted) {
        setLoading(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [router]);

  if (loading) {
    return <p className="notice">Loading...</p>;
  }

  if (profileError) {
    return <p className="notice">{profileError}</p>;
  }

  return (
    <section className="card">
      <h2>Report Missing/Absent Case</h2>
      <p className="notice">One click reporting for team leads.</p>
      {workerCount === 0 && (
        <div
          style={{
            padding: '12px',
            borderRadius: '8px',
            background: '#fef3c7',
            color: '#92400e',
            marginBottom: '12px',
          }}
        >
          <strong>No workers found for this team.</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: '18px' }}>
            <li>No workers in this team.</li>
            <li>Profile.team_id mismatch.</li>
            <li>RLS blocking access.</li>
          </ul>
        </div>
      )}
      <form method="post" action="/api/team/report">
        <label>
          Worker
          <select name="worker_id" required>
            <option value="">Select worker</option>
            {workers.map((worker) => (
              <option key={worker.id} value={worker.id}>
                {worker.full_name} ({worker.team?.name ?? 'Unassigned'})
              </option>
            ))}
          </select>
        </label>
        <label>
          Reason
          <input name="reason" placeholder="Absent / Missing" required />
        </label>
        <label>
          Note
          <textarea name="note" rows={3} />
        </label>
        <button type="submit">Report Case</button>
      </form>
      {DEV_MODE && (
        <div
          style={{
            marginTop: '16px',
            padding: '12px',
            borderRadius: '8px',
            border: '1px dashed #94a3b8',
            fontSize: '12px',
          }}
        >
          <strong>Debug Panel (dev only)</strong>
          <div>User ID: {userId ?? 'unknown'}</div>
          <div>Role: {profile?.role ?? 'unknown'}</div>
          <div>Team ID: {profile?.team_id ?? 'unknown'}</div>
          <div>Workers loaded: {workerCount}</div>
        </div>
      )}
    </section>
  );
}
