'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

type Team = {
  id: string;
  name: string | null;
};

type Worker = {
  id: string;
  full_name: string;
  team_id: string | null;
};

type Profile = {
  id: string;
  role: string | null;
  team_id: string | null;
};

const DEV_MODE = process.env.NODE_ENV === 'development';

export default function DevDbCheckPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      if (!DEV_MODE) {
        setError('This page is only available in development.');
        setLoading(false);
        return;
      }

      const { data: userData } = await supabaseBrowser.auth.getUser();

      if (!userData.user) {
        router.replace('/login');
        return;
      }

      const { data: profileData } = await supabaseBrowser
        .from('profiles')
        .select('id, role, team_id')
        .eq('id', userData.user.id)
        .single();

      if (!profileData || profileData.role !== 'ADMIN') {
        setError('Admin access required.');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/dev/db-check');
      if (!response.ok) {
        setError('Unable to load database check data.');
        setLoading(false);
        return;
      }

      const payload = (await response.json()) as {
        teams: Team[];
        workers: Worker[];
        profiles: Profile[];
      };

      if (!isMounted) return;

      setTeams(payload.teams ?? []);
      setWorkers(payload.workers ?? []);
      setProfiles(payload.profiles ?? []);
      setLoading(false);
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [router]);

  if (loading) {
    return <p className="notice">Loading...</p>;
  }

  if (error) {
    return <p className="notice">{error}</p>;
  }

  return (
    <section className="card">
      <h2>Dev DB Check</h2>
      <p className="notice">Temporary admin-only view to verify team mappings.</p>
      <h3>Teams</h3>
      <ul>
        {teams.map((team) => (
          <li key={team.id}>
            {team.name ?? 'Unnamed'} ({team.id})
          </li>
        ))}
      </ul>
      <h3>Workers</h3>
      <ul>
        {workers.map((worker) => (
          <li key={worker.id}>
            {worker.full_name} - team_id: {worker.team_id ?? 'none'}
          </li>
        ))}
      </ul>
      <h3>Profiles</h3>
      <ul>
        {profiles.map((profile) => (
          <li key={profile.id}>
            {profile.id} - role: {profile.role ?? 'none'} - team_id: {profile.team_id ?? 'none'}
          </li>
        ))}
      </ul>
    </section>
  );
}
