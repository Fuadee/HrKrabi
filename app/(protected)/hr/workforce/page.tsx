"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type Profile = {
  role: string;
};

type TeamSummary = {
  id: string;
  name: string;
  capacity: number;
  district_name: string | null;
  active_headcount: number;
  missing_count: number;
  last_update: string | null;
};

type TeamOption = {
  id: string;
  name: string;
  district_name: string | null;
};

type MemberRow = {
  id: string;
  full_name: string;
  national_id?: string | null;
  status?: string | null;
  start_date: string;
  membership_status: string;
};

type WorkforceResponse = {
  data?: {
    district: string;
    districts: string[];
    teams: TeamSummary[];
    availableTeams: TeamOption[];
    activeMembers: MemberRow[];
  };
  error?: string;
};

const districtOptions = [
  "เมืองกระบี่",
  "อ่าวลึก",
  "เหนือคลอง",
  "เขาพนม",
  "คลองท่อม",
  "เกาะลันตา",
  "ไม่ระบุ",
];

const setDistrictOptions = [
  "เมืองกระบี่",
  "อ่าวลึก",
  "เหนือคลอง",
  "เขาพนม",
  "คลองท่อม",
  "เกาะลันตา",
  "ไม่ระบุ",
];

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString();
}

export default function HrWorkforcePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [districts, setDistricts] = useState<string[]>(districtOptions);
  const [selectedDistrict, setSelectedDistrict] = useState("ไม่ระบุ");
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [availableTeams, setAvailableTeams] = useState<TeamOption[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [activeMembers, setActiveMembers] = useState<MemberRow[]>([]);
  const [teamSearch, setTeamSearch] = useState("");
  const [updatingTeamId, setUpdatingTeamId] = useState<string | null>(null);

  const getAccessToken = async () => {
    const supabase = getSupabaseBrowserClient();
    const { data: sessionData } = await supabase.auth.getSession();
    return sessionData.session?.access_token ?? null;
  };

  const fetchWorkforce = async (districtName: string) => {
    setLoadingData(true);
    setError(null);

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        router.replace("/login");
        return;
      }

      const response = await fetch(
        `/api/hr/workforce?district=${encodeURIComponent(districtName)}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      const payload = (await response.json()) as WorkforceResponse;

      if (!response.ok) {
        setError(payload.error ?? "Unable to load workforce data.");
        setLoadingData(false);
        return;
      }

      if (payload.data) {
        setDistricts(payload.data.districts);
        setTeams(payload.data.teams);
        setAvailableTeams(payload.data.availableTeams);
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unexpected error.",
      );
    } finally {
      setLoadingData(false);
    }
  };

  const fetchMembers = async (teamId: string, districtName: string) => {
    setLoadingMembers(true);
    setError(null);

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        router.replace("/login");
        return;
      }

      const response = await fetch(
        `/api/hr/workforce?district=${encodeURIComponent(
          districtName,
        )}&teamId=${encodeURIComponent(teamId)}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      const payload = (await response.json()) as WorkforceResponse;

      if (!response.ok) {
        setError(payload.error ?? "Unable to load team members.");
        setLoadingMembers(false);
        return;
      }

      if (payload.data) {
        setActiveMembers(payload.data.activeMembers);
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unexpected error.",
      );
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      const supabase = getSupabaseBrowserClient();
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError || !userData.user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userData.user.id)
        .single<Profile>();

      if (!isMounted) {
        return;
      }

      if (profileError || !profile) {
        setError(profileError?.message ?? "Unable to load profile.");
        setLoading(false);
        return;
      }

      setRole(profile.role);

      if (profile.role !== "hr_prov") {
        setError("Only HR province can access this page.");
        setLoading(false);
        return;
      }

      setLoading(false);
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [router]);

  useEffect(() => {
    if (role !== "hr_prov") {
      return;
    }

    fetchWorkforce(selectedDistrict);
    setSelectedTeamId(null);
    setActiveMembers([]);
  }, [role, selectedDistrict]);

  const handleTeamSelect = async (teamId: string) => {
    setSelectedTeamId(teamId);
    setActiveMembers([]);
    await fetchMembers(teamId, selectedDistrict);
  };

  const handleDistrictUpdate = async (teamId: string, value: string) => {
    if (value.length === 0) {
      return;
    }

    setUpdatingTeamId(teamId);
    setError(null);

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        router.replace("/login");
        return;
      }

      const response = await fetch(`/api/hr/teams/${teamId}/district`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ district_name: value }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(payload.error ?? "Unable to update district.");
        setUpdatingTeamId(null);
        return;
      }

      await fetchWorkforce(selectedDistrict);
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Unexpected error.",
      );
    } finally {
      setUpdatingTeamId(null);
    }
  };

  const filteredTeamOptions = useMemo(() => {
    return availableTeams.filter(
      (team) => team.district_name === selectedDistrict,
    );
  }, [availableTeams, selectedDistrict]);

  const visibleTeams = useMemo(() => {
    const searchTerm = teamSearch.trim().toLowerCase();
    if (!searchTerm) {
      return filteredTeamOptions;
    }

    return filteredTeamOptions.filter((team) =>
      team.name.toLowerCase().includes(searchTerm),
    );
  }, [filteredTeamOptions, teamSearch]);

  const selectedTeam = useMemo(() => {
    return teams.find((team) => team.id === selectedTeamId) ?? null;
  }, [teams, selectedTeamId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Workforce visibility</h1>
        <p className="text-sm text-slate-400">
          Monitor active headcount and missing coverage across Krabi districts.
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-md border border-slate-800 bg-slate-900/40 px-4 py-6 text-sm text-slate-300">
          Loading workforce overview...
        </div>
      ) : null}

      {!loading && role === "hr_prov" ? (
        <div className="space-y-6">
          <div className="grid gap-4 rounded-lg border border-slate-800 bg-slate-900/40 p-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm text-slate-300">District</label>
              <select
                value={selectedDistrict}
                onChange={(event) => setSelectedDistrict(event.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              >
                {districts.map((district) => (
                  <option key={district} value={district}>
                    {district}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-300">Team search</label>
              <input
                value={teamSearch}
                onChange={(event) => setTeamSearch(event.target.value)}
                placeholder="Search teams..."
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              />
              <select
                value={selectedTeamId ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value) {
                    handleTeamSelect(value);
                  }
                }}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              >
                <option value="">Select a team</option>
                {visibleTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/60 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-200">
                Teams in {selectedDistrict}
              </h2>
              <span className="text-xs text-slate-400">
                {loadingData ? "Updating..." : `${teams.length} teams`}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-900/80 text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-4 py-3">อำเภอ</th>
                    <th className="px-4 py-3">ทีม</th>
                    <th className="px-4 py-3">Capacity</th>
                    <th className="px-4 py-3">Active headcount</th>
                    <th className="px-4 py-3">Missing</th>
                    <th className="px-4 py-3">Last update</th>
                    <th className="px-4 py-3 text-right">Set district</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {teams.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-6 text-center text-sm text-slate-400"
                      >
                        No teams found for this district.
                      </td>
                    </tr>
                  ) : (
                    teams.map((team) => (
                      <tr
                        key={team.id}
                        className="cursor-pointer bg-slate-950/40 transition hover:bg-slate-900/50"
                        onClick={() => handleTeamSelect(team.id)}
                      >
                        <td className="px-4 py-3 text-slate-200">
                          {team.district_name ?? "ไม่ระบุ"}
                        </td>
                        <td className="px-4 py-3 text-slate-100">
                          {team.name}
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {team.capacity}
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {team.active_headcount}
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {team.missing_count}
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {formatDate(team.last_update)}
                        </td>
                        <td
                          className="px-4 py-3 text-right"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <select
                            value={team.district_name ?? "ไม่ระบุ"}
                            onChange={(event) =>
                              handleDistrictUpdate(team.id, event.target.value)
                            }
                            disabled={updatingTeamId === team.id}
                            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                          >
                            {setDistrictOptions.map((district) => (
                              <option key={district} value={district}>
                                {district}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-200">
                  Active members
                </h3>
                <p className="text-xs text-slate-400">
                  {selectedTeam
                    ? `Team: ${selectedTeam.name}`
                    : "Select a team to see active members."}
                </p>
              </div>
              {loadingMembers ? (
                <span className="text-xs text-slate-400">Loading...</span>
              ) : null}
            </div>

            {selectedTeam ? (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase text-slate-400">
                    <tr>
                      <th className="px-3 py-2">full_name</th>
                      <th className="px-3 py-2">start_date</th>
                      <th className="px-3 py-2">national_id</th>
                      <th className="px-3 py-2">membership status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {activeMembers.length === 0 && !loadingMembers ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-3 py-4 text-center text-xs text-slate-400"
                        >
                          No active members found.
                        </td>
                      </tr>
                    ) : (
                      activeMembers.map((member) => (
                        <tr key={member.id} className="text-slate-200">
                          <td className="px-3 py-2">{member.full_name}</td>
                          <td className="px-3 py-2">
                            {formatDate(member.start_date)}
                          </td>
                          <td className="px-3 py-2">
                            {member.national_id ?? "-"}
                          </td>
                          <td className="px-3 py-2">
                            {member.membership_status}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
