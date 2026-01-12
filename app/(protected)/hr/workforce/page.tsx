"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { SectionHeader } from "@/components/ui/SectionHeader";

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

  return new Date(value).toLocaleDateString("th-TH");
}

const membershipStatusLabels: Record<string, string> = {
  active: "ปฏิบัติงาน",
  inactive: "สิ้นสุดแล้ว",
  pending: "รอดำเนินการ",
};

const formatMembershipStatus = (value?: string | null) => {
  if (!value) {
    return "-";
  }

  return membershipStatusLabels[value] ?? value;
};

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
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [activeMembers, setActiveMembers] = useState<MemberRow[]>([]);
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
        setError(payload.error ?? "ไม่สามารถโหลดข้อมูลอัตรากำลังได้");
        setLoadingData(false);
        return;
      }

      if (payload.data) {
        setDistricts(payload.data.districts);
        setTeams(payload.data.teams);
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "เกิดข้อผิดพลาดที่ไม่คาดคิด",
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
        setError(payload.error ?? "ไม่สามารถโหลดรายชื่อกำลังคนได้");
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
          : "เกิดข้อผิดพลาดที่ไม่คาดคิด",
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
        setError(profileError?.message ?? "ไม่สามารถโหลดโปรไฟล์ได้");
        setLoading(false);
        return;
      }

      setRole(profile.role);

      if (profile.role !== "hr_prov") {
        setError("เฉพาะ HR จังหวัดเท่านั้นที่เข้าถึงหน้านี้ได้");
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
        setError(payload.error ?? "ไม่สามารถอัปเดตอำเภอได้");
        setUpdatingTeamId(null);
        return;
      }

      await fetchWorkforce(selectedDistrict);
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "เกิดข้อผิดพลาดที่ไม่คาดคิด",
      );
    } finally {
      setUpdatingTeamId(null);
    }
  };

  const selectedTeam = useMemo(() => {
    return teams.find((team) => team.id === selectedTeamId) ?? null;
  }, [teams, selectedTeamId]);

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-[#E7EEF8]">
          ภาพรวมอัตรากำลัง
        </h1>
        <p className="text-sm text-slate-400">
          ติดตามกำลังคนปฏิบัติงานและตำแหน่งที่ขาดในจังหวัดกระบี่
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-md border border-white/5 bg-[#0B1220] px-4 py-6 text-sm text-slate-300">
          กำลังโหลดภาพรวมอัตรากำลัง...
        </div>
      ) : null}

      {!loading && role === "hr_prov" ? (
        <div className="space-y-7">
          <div className="space-y-4">
            <SectionHeader
              title="ตัวกรอง"
              subtitle="กำหนดอำเภอ"
              action={
                <div className="w-full max-w-[420px] md:min-w-[360px]">
                  <label className="text-xs text-slate-400">อำเภอ</label>
                  <select
                    value={selectedDistrict}
                    onChange={(event) =>
                      setSelectedDistrict(event.target.value)
                    }
                    className="select-premium mt-2"
                  >
                    {districts.map((district) => (
                      <option key={district} value={district}>
                        {district}
                      </option>
                    ))}
                  </select>
                </div>
              }
            />
          </div>

          <div className="space-y-4">
            <SectionHeader
              title="รายการทีม"
              subtitle={`ทีมในอำเภอ ${selectedDistrict}`}
              action={
                <span className="text-xs text-slate-400">
                  {loadingData ? "กำลังอัปเดต..." : `ทั้งหมด ${teams.length} ทีม`}
                </span>
              }
            />
            <div className="overflow-hidden rounded-xl border border-white/5">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[#0E1629]">
                    <tr>
                      <th className="table-header-cell px-4 py-3">อำเภอ</th>
                      <th className="table-header-cell px-4 py-3">ทีม</th>
                      <th className="table-header-cell px-4 py-3">
                        อัตรากำลัง
                      </th>
                      <th className="table-header-cell px-4 py-3">
                        กำลังคนปฏิบัติงาน
                      </th>
                      <th className="table-header-cell px-4 py-3">ขาด</th>
                      <th className="table-header-cell px-4 py-3">
                        อัปเดตล่าสุด
                      </th>
                      <th className="table-header-cell px-4 py-3 text-right">
                        กำหนดอำเภอ
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {teams.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-6 text-center text-sm text-slate-400"
                        >
                          ไม่พบทีมในอำเภอนี้
                        </td>
                      </tr>
                    ) : (
                      teams.map((team) => (
                        <tr
                          key={team.id}
                          className="table-row-hover cursor-pointer bg-[#050814]/40"
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
                                handleDistrictUpdate(
                                  team.id,
                                  event.target.value,
                                )
                              }
                              disabled={updatingTeamId === team.id}
                              className="select-premium text-xs"
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
          </div>

          <div className="space-y-4">
            <SectionHeader
              title="กำลังคนปฏิบัติงาน"
              subtitle={selectedTeam ? `ทีม: ${selectedTeam.name}` : undefined}
              action={
                loadingMembers ? (
                  <span className="text-xs text-slate-400">
                    กำลังโหลด...
                  </span>
                ) : null
              }
            />

            {selectedTeam ? (
              <div className="overflow-x-auto rounded-xl border border-white/5">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[#0E1629]">
                    <tr>
                      <th className="table-header-cell px-3 py-2">
                        ชื่อ-สกุล
                      </th>
                      <th className="table-header-cell px-3 py-2">
                        วันที่เริ่ม
                      </th>
                      <th className="table-header-cell px-3 py-2">
                        เลขประจำตัวประชาชน
                      </th>
                      <th className="table-header-cell px-3 py-2">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {activeMembers.length === 0 && !loadingMembers ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-3 py-4 text-center text-xs text-slate-400"
                        >
                          ไม่พบกำลังคนปฏิบัติงาน
                        </td>
                      </tr>
                    ) : (
                      activeMembers.map((member) => (
                        <tr key={member.id} className="table-row-hover">
                          <td className="px-3 py-2 text-slate-200">
                            {member.full_name}
                          </td>
                          <td className="px-3 py-2 text-slate-300">
                            {formatDate(member.start_date)}
                          </td>
                          <td className="px-3 py-2 text-slate-300">
                            {member.national_id ?? "-"}
                          </td>
                          <td className="px-3 py-2 text-slate-300">
                            {formatMembershipStatus(member.membership_status)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-400">
                คลิกทีมจากรายการด้านบนเพื่อดูรายชื่อกำลังคนปฏิบัติงาน
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
