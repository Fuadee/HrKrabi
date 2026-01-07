insert into teams (id, name)
values
  ('11111111-1111-1111-1111-111111111111', 'North Region'),
  ('22222222-2222-2222-2222-222222222222', 'South Region');

insert into workers (id, team_id, full_name, employee_code)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Aira Kanya', 'NK-001'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'Pravit Mane', 'NK-002'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222', 'Suda Kitt', 'SK-201');

insert into cases (id, worker_id, team_id, reported_at, case_status, reason, note)
values
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', now() - interval '1 day', 'REPORTED', 'Absent', 'Reported by TL');
