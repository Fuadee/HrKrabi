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
  missing_capacity: number;
  open_cases: number;
  last_case_update: string | null;
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
    return "ยังไม่มีข้อมูล";
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
    <div className="space-y-8 rounded-[28px] bg-[#F7F8FA] p-6 shadow-sm">
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-3xl font-bold text-[#111827]">
            ภาพรวมอัตรากำลัง
          </h1>
          <span
            aria-hidden="true"
            className="mt-3 block h-[3px] w-16 rounded-full bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#515BD4]"
          />
        </div>
        <p className="text-sm text-[#6B7280]">
          ติดตามกำลังคนปฏิบัติงานและตำแหน่งที่ขาดในจังหวัดกระบี่
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 shadow-sm">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-[#E9EBF0] bg-white px-4 py-6 text-sm text-slate-600 shadow-sm">
          กำลังโหลดภาพรวมอัตรากำลัง...
        </div>
      ) : null}

      {!loading && role === "hr_prov" ? (
        <div className="space-y-7">
          <div className="space-y-4">
            <SectionHeader
              title="ตัวกรอง"
              subtitle="กำหนดอำเภอ"
              accent="gradient"
              className="px-6 py-4"
              action={
                <div className="w-full max-w-[420px] md:min-w-[360px]">
                  <label className="text-xs font-medium text-slate-500">
                    อำเภอ
                  </label>
                  <select
                    value={selectedDistrict}
                    onChange={(event) =>
                      setSelectedDistrict(event.target.value)
                    }
                    className="select-premium mt-2 rounded-2xl px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8134AF]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F7F8FA]"
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
              accent="gradient"
              className="px-6 py-4"
              action={
                <span className="text-xs text-slate-500">
                  {loadingData ? "กำลังอัปเดต..." : `ทั้งหมด ${teams.length} ทีม`}
                </span>
              }
            />
            <div className="card-surface overflow-hidden rounded-2xl border border-[#E9EBF0]">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[#F3F4F6] text-[#374151]">
                    <tr>
                      <th className="table-header-cell px-4 py-3">ทีม</th>
                      <th className="table-header-cell px-4 py-3">
                        อัตรากำลัง
                      </th>
                      <th className="table-header-cell px-4 py-3">
                        กำลังคนปฏิบัติงาน
                      </th>
                      <th className="table-header-cell px-4 py-3">
                        ขาดตามอัตรากำลัง
                      </th>
                      <th className="table-header-cell px-4 py-3">
                        เคสเปิดอยู่
                      </th>
                      <th className="table-header-cell px-4 py-3">
                        อัปเดตเคสล่าสุด
                      </th>
                      <th className="table-header-cell px-4 py-3 text-right">
                        กำหนดอำเภอ
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF2F7]">
                    {teams.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-6 text-center text-sm text-slate-500"
                        >
                          ไม่พบทีมในอำเภอนี้
                        </td>
                      </tr>
                    ) : (
                      teams.map((team) => (
                        <tr
                          key={team.id}
                          className="table-row-hover cursor-pointer bg-white"
                          onClick={() => handleTeamSelect(team.id)}
                        >
                          <td className="px-4 py-3 font-medium text-slate-800">
                            {team.name}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {team.capacity}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {team.active_headcount}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {team.missing_capacity}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {team.open_cases}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {formatDate(team.last_case_update ?? team.last_update)}
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
                              className="select-premium rounded-2xl px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8134AF]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
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
              accent="gradient"
              className="px-6 py-4"
              action={
                loadingMembers ? (
                  <span className="text-xs text-slate-500">
                    กำลังโหลด...
                  </span>
                ) : null
              }
            />

            {selectedTeam ? (
              <div className="card-surface overflow-x-auto rounded-2xl border border-[#E9EBF0]">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[#F3F4F6] text-[#374151]">
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
                  <tbody className="divide-y divide-[#EEF2F7]">
                    {activeMembers.length === 0 && !loadingMembers ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-3 py-4 text-center text-xs text-slate-500"
                        >
                          ไม่พบกำลังคนปฏิบัติงาน
                        </td>
                      </tr>
                    ) : (
                      activeMembers.map((member) => (
                        <tr key={member.id} className="table-row-hover bg-white">
                          <td className="px-3 py-2 font-medium text-slate-800">
                            {member.full_name}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {formatDate(member.start_date)}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {member.national_id ?? "-"}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {formatMembershipStatus(member.membership_status)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                คลิกทีมจากรายการด้านบนเพื่อดูรายชื่อกำลังคนปฏิบัติงาน
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
