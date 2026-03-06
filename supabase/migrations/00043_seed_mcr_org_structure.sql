-- Seed MCR Pathways organisational structure with fake names but real job titles
-- Based on the MCR Pathways Organisational Structure (January 2026)
-- Guard: only seed if fewer than 10 profiles exist (avoid duplicating in production)

DO $$
BEGIN
  IF (SELECT count(*) FROM public.profiles) < 10 THEN

    -- =========================================
    -- LEVEL 1: Chief Executive
    -- =========================================
    INSERT INTO public.profiles (id, full_name, email, job_title, department, region, line_manager_id, status, user_type, fte, is_line_manager, is_external, is_hr_admin, is_ld_admin, is_systems_admin)
    VALUES
      ('a0000000-0000-4000-8000-000000000001', 'Eleanor MacGregor', 'eleanor.macgregor@mcrpathways.org', 'Chief Executive', 'executive', 'west', NULL, 'active', 'staff', 1.0, true, false, true, false, false);

    -- =========================================
    -- LEVEL 2: Directors (report to CEO)
    -- =========================================
    INSERT INTO public.profiles (id, full_name, email, job_title, department, region, line_manager_id, status, user_type, fte, is_line_manager, is_external, is_hr_admin, is_ld_admin, is_systems_admin)
    VALUES
      ('a0000000-0000-4000-8000-000000000002', 'Fiona Henderson', 'fiona.henderson@mcrpathways.org', 'People Director', 'people', 'west', 'a0000000-0000-4000-8000-000000000001', 'active', 'staff', 1.0, true, false, true, false, false),
      ('a0000000-0000-4000-8000-000000000003', 'Graham Nicholson', 'graham.nicholson@mcrpathways.org', 'Finance Director', 'finance', 'west', 'a0000000-0000-4000-8000-000000000001', 'active', 'staff', 0.6, true, false, false, false, false),
      ('a0000000-0000-4000-8000-000000000004', 'Rachel Donaldson', 'rachel.donaldson@mcrpathways.org', 'Delivery Director', 'delivery', 'west', 'a0000000-0000-4000-8000-000000000001', 'active', 'staff', 1.0, true, false, false, false, false),
      ('a0000000-0000-4000-8000-000000000005', 'Margaret Campbell', 'margaret.campbell@mcrpathways.org', 'Development Director', 'development', 'west', 'a0000000-0000-4000-8000-000000000001', 'active', 'staff', 1.0, true, false, false, false, false);

    -- =========================================
    -- CENTRAL TEAM: People Director reports
    -- =========================================

    -- HR team (reports to People Director)
    INSERT INTO public.profiles (id, full_name, email, job_title, department, region, line_manager_id, status, user_type, fte, is_line_manager, is_external, is_hr_admin, is_ld_admin, is_systems_admin)
    VALUES
      ('a0000000-0000-4000-8000-000000000010', 'Sarah Mitchell', 'sarah.mitchell@mcrpathways.org', 'HR Advisor', 'hr', 'west', 'a0000000-0000-4000-8000-000000000002', 'active', 'staff', 1.0, false, false, true, false, false),
      ('a0000000-0000-4000-8000-000000000011', 'Isla Robertson', 'isla.robertson@mcrpathways.org', 'Executive Support Coordinator', 'hr', 'west', 'a0000000-0000-4000-8000-000000000002', 'active', 'staff', 0.6, false, false, false, false, false);

    -- L&D team (reports to People Director)
    INSERT INTO public.profiles (id, full_name, email, job_title, department, region, line_manager_id, status, user_type, fte, is_line_manager, is_external, is_hr_admin, is_ld_admin, is_systems_admin)
    VALUES
      ('a0000000-0000-4000-8000-000000000012', 'David Murray', 'david.murray@mcrpathways.org', 'Learning & Development Manager', 'learning_development', 'west', 'a0000000-0000-4000-8000-000000000002', 'active', 'staff', 1.0, true, false, false, true, false);

    -- L&D sub-team (reports to L&D Manager)
    INSERT INTO public.profiles (id, full_name, email, job_title, department, region, line_manager_id, status, user_type, fte, is_line_manager, is_external, is_hr_admin, is_ld_admin, is_systems_admin)
    VALUES
      ('a0000000-0000-4000-8000-000000000013', 'Heather Wallace', 'heather.wallace@mcrpathways.org', 'Regional Quality & Learning Lead', 'learning_development', 'west', 'a0000000-0000-4000-8000-000000000012', 'active', 'staff', 1.0, false, false, false, false, false),
      ('a0000000-0000-4000-8000-000000000014', 'Claire Thomson', 'claire.thomson@mcrpathways.org', 'Regional Quality & Learning Lead', 'learning_development', 'east', 'a0000000-0000-4000-8000-000000000012', 'active', 'staff', 1.0, false, false, false, false, false);

    -- =========================================
    -- CENTRAL TEAM: Finance Director reports
    -- =========================================
    INSERT INTO public.profiles (id, full_name, email, job_title, department, region, line_manager_id, status, user_type, fte, is_line_manager, is_external, is_hr_admin, is_ld_admin, is_systems_admin)
    VALUES
      ('a0000000-0000-4000-8000-000000000020', 'Laura Paterson', 'laura.paterson@mcrpathways.org', 'Finance Manager', 'finance', 'west', 'a0000000-0000-4000-8000-000000000003', 'active', 'staff', 0.8, false, false, false, false, false);

    -- =========================================
    -- CENTRAL TEAM: Delivery Director reports (central)
    -- =========================================

    -- NOTE: Head of Systems (Colin Adam) and Systems Coordinator (Abdulmuiz Adaranijo)
    -- are real users — NOT seeded here. They must be assigned manually after seeding.
    -- Systems team members (report to Colin Adam, the real Head of Systems)
    -- line_manager_id must be updated post-seed to point to Colin's real profile ID.
    INSERT INTO public.profiles (id, full_name, email, job_title, department, region, line_manager_id, status, user_type, fte, is_line_manager, is_external, is_hr_admin, is_ld_admin, is_systems_admin)
    VALUES
      ('a0000000-0000-4000-8000-000000000031', 'Ryan MacLeod', 'ryan.macleod@mcrpathways.org', 'Systems and Infrastructure Officer', 'systems', 'west', 'a0000000-0000-4000-8000-000000000004', 'active', 'staff', 1.0, false, false, false, false, true),
      ('a0000000-0000-4000-8000-000000000032', 'Karen Stewart', 'karen.stewart@mcrpathways.org', 'Evidence & Impact Officer', 'systems', 'west', 'a0000000-0000-4000-8000-000000000004', 'active', 'staff', 1.0, false, false, false, false, false);

    -- =========================================
    -- CENTRAL TEAM: Development Director reports (central)
    -- =========================================

    -- Head of Engagement (reports to Development Director)
    INSERT INTO public.profiles (id, full_name, email, job_title, department, region, line_manager_id, status, user_type, fte, is_line_manager, is_external, is_hr_admin, is_ld_admin, is_systems_admin)
    VALUES
      ('a0000000-0000-4000-8000-000000000040', 'Priya Sharma', 'priya.sharma@mcrpathways.org', 'Head of Engagement and Influencing', 'engagement', 'west', 'a0000000-0000-4000-8000-000000000005', 'active', 'staff', 1.0, true, false, false, false, false);

    -- Engagement sub-teams (report to Head of Engagement)
    INSERT INTO public.profiles (id, full_name, email, job_title, department, region, line_manager_id, status, user_type, fte, is_line_manager, is_external, is_hr_admin, is_ld_admin, is_systems_admin)
    VALUES
      -- Mentor and Young People Engagement
      ('a0000000-0000-4000-8000-000000000041', 'Callum Reid', 'callum.reid@mcrpathways.org', 'Mentor and Young People Engagement Officer', 'engagement', 'west', 'a0000000-0000-4000-8000-000000000040', 'active', 'staff', 1.0, false, false, false, false, false),
      ('a0000000-0000-4000-8000-000000000042', 'Hannah Douglas', 'hannah.douglas@mcrpathways.org', 'Mentor and Young People Engagement Officer', 'engagement', 'west', 'a0000000-0000-4000-8000-000000000040', 'active', 'staff', 1.0, false, false, false, false, false),
      -- Strategic Communications Lead
      ('a0000000-0000-4000-8000-000000000043', 'Neil Crawford', 'neil.crawford@mcrpathways.org', 'Strategic Communications Lead', 'communications', 'west', 'a0000000-0000-4000-8000-000000000040', 'active', 'staff', 1.0, true, false, false, false, false);

    -- Communications sub-team (reports to Strategic Communications Lead)
    INSERT INTO public.profiles (id, full_name, email, job_title, department, region, line_manager_id, status, user_type, fte, is_line_manager, is_external, is_hr_admin, is_ld_admin, is_systems_admin)
    VALUES
      ('a0000000-0000-4000-8000-000000000044', 'Megan Scott', 'megan.scott@mcrpathways.org', 'Senior Marketing Officer', 'communications', 'west', 'a0000000-0000-4000-8000-000000000043', 'active', 'staff', 1.0, false, false, false, false, false),
      ('a0000000-0000-4000-8000-000000000045', 'Aisha Begum', 'aisha.begum@mcrpathways.org', 'Policy & Public Affairs Officer', 'communications', 'west', 'a0000000-0000-4000-8000-000000000043', 'active', 'staff', 1.0, false, false, false, false, false),
      ('a0000000-0000-4000-8000-000000000046', 'Lucy Brennan', 'lucy.brennan@mcrpathways.org', 'Policy & Public Affairs Officer', 'communications', 'west', 'a0000000-0000-4000-8000-000000000043', 'active', 'staff', 1.0, false, false, false, false, false);

    -- Head of Fundraising (reports to Development Director)
    INSERT INTO public.profiles (id, full_name, email, job_title, department, region, line_manager_id, status, user_type, fte, is_line_manager, is_external, is_hr_admin, is_ld_admin, is_systems_admin)
    VALUES
      ('a0000000-0000-4000-8000-000000000050', 'Victoria Grant', 'victoria.grant@mcrpathways.org', 'Head of Fundraising', 'fundraising', 'west', 'a0000000-0000-4000-8000-000000000005', 'active', 'staff', 1.0, true, false, false, false, false);

    -- Fundraising team (reports to Head of Fundraising)
    INSERT INTO public.profiles (id, full_name, email, job_title, department, region, line_manager_id, status, user_type, fte, is_line_manager, is_external, is_hr_admin, is_ld_admin, is_systems_admin)
    VALUES
      ('a0000000-0000-4000-8000-000000000051', 'Jennifer Kerr', 'jennifer.kerr@mcrpathways.org', 'Senior Fundraising Officer', 'fundraising', 'west', 'a0000000-0000-4000-8000-000000000050', 'active', 'staff', 1.0, false, false, false, false, false),
      ('a0000000-0000-4000-8000-000000000052', 'Robyn Anderson', 'robyn.anderson@mcrpathways.org', 'Fundraising Officer', 'fundraising', 'west', 'a0000000-0000-4000-8000-000000000050', 'active', 'staff', 1.0, false, false, false, false, false),
      ('a0000000-0000-4000-8000-000000000053', 'Aileen Fraser', 'aileen.fraser@mcrpathways.org', 'Strategic Partnerships Lead', 'fundraising', 'east', 'a0000000-0000-4000-8000-000000000050', 'active', 'staff', 1.0, false, false, false, false, false);

    -- =========================================
    -- WEST REGION (reports to Delivery Director)
    -- =========================================

    -- Head of Schools West
    INSERT INTO public.profiles (id, full_name, email, job_title, department, region, line_manager_id, status, user_type, fte, is_line_manager, is_external, is_hr_admin, is_ld_admin, is_systems_admin)
    VALUES
      ('a0000000-0000-4000-8000-000000000060', 'James Crawford', 'james.crawford@mcrpathways.org', 'Head of Schools (West)', 'delivery', 'west', 'a0000000-0000-4000-8000-000000000004', 'active', 'staff', 1.0, true, false, false, false, false);

    -- West Programme Managers (report to Head of Schools West)
    INSERT INTO public.profiles (id, full_name, email, job_title, department, region, line_manager_id, status, user_type, fte, is_line_manager, is_external, is_hr_admin, is_ld_admin, is_systems_admin)
    VALUES
      ('a0000000-0000-4000-8000-000000000061', 'Gemma Taylor', 'gemma.taylor@mcrpathways.org', 'Programme Manager', 'delivery', 'west', 'a0000000-0000-4000-8000-000000000060', 'active', 'staff', 1.0, true, false, false, false, false),
      ('a0000000-0000-4000-8000-000000000062', 'Scott Wilson', 'scott.wilson@mcrpathways.org', 'Programme Manager', 'delivery', 'west', 'a0000000-0000-4000-8000-000000000060', 'active', 'staff', 1.0, true, false, false, false, false),
      ('a0000000-0000-4000-8000-000000000063', 'Amy MacDonald', 'amy.macdonald@mcrpathways.org', 'Programme Manager', 'delivery', 'west', 'a0000000-0000-4000-8000-000000000060', 'active', 'staff', 1.0, true, false, false, false, false),
      ('a0000000-0000-4000-8000-000000000064', 'Emma Clark', 'emma.clark@mcrpathways.org', 'Programme Manager', 'delivery', 'west', 'a0000000-0000-4000-8000-000000000060', 'active', 'staff', 1.0, true, false, false, false, false);

    -- West Senior Partnerships Managers (report to Head of Schools West)
    INSERT INTO public.profiles (id, full_name, email, job_title, department, region, line_manager_id, status, user_type, fte, is_line_manager, is_external, is_hr_admin, is_ld_admin, is_systems_admin)
    VALUES
      ('a0000000-0000-4000-8000-000000000065', 'Kirsty Hamilton', 'kirsty.hamilton@mcrpathways.org', 'Senior Partnerships Manager', 'delivery', 'west', 'a0000000-0000-4000-8000-000000000060', 'active', 'staff', 1.0, true, false, false, false, false),
      ('a0000000-0000-4000-8000-000000000066', 'Nicola Johnstone', 'nicola.johnstone@mcrpathways.org', 'Senior Partnerships Manager', 'delivery', 'west', 'a0000000-0000-4000-8000-000000000060', 'active', 'staff', 1.0, true, false, false, false, false);

    -- GCC Programme Managers - Glasgow (report to Head of Schools West, EXTERNAL)
    INSERT INTO public.profiles (id, full_name, email, job_title, department, region, line_manager_id, status, user_type, fte, is_line_manager, is_external, is_hr_admin, is_ld_admin, is_systems_admin)
    VALUES
      ('a0000000-0000-4000-8000-000000000067', 'Diane Morrison', 'diane.morrison@mcrpathways.org', 'Programme Manager', 'delivery', 'west', 'a0000000-0000-4000-8000-000000000060', 'active', 'staff', 1.0, true, true, false, false, false),
      ('a0000000-0000-4000-8000-000000000068', 'Brian Kelly', 'brian.kelly@mcrpathways.org', 'Programme Manager', 'delivery', 'west', 'a0000000-0000-4000-8000-000000000060', 'active', 'staff', 1.0, true, true, false, false, false);

    -- West MS Coordinators (report to their Programme Managers)
    INSERT INTO public.profiles (id, full_name, email, job_title, department, region, line_manager_id, status, user_type, fte, is_line_manager, is_external, is_hr_admin, is_ld_admin, is_systems_admin)
    VALUES
      -- Reports to Gemma Taylor (South Lanarkshire PM)
      ('a0000000-0000-4000-8000-000000000070', 'Zara Ahmed', 'zara.ahmed@mcrpathways.org', 'MS Coordinator', 'delivery', 'west', 'a0000000-0000-4000-8000-000000000061', 'active', 'staff', 1.0, false, false, false, false, false),
      -- Reports to Scott Wilson (North Ayrshire PM)
      ('a0000000-0000-4000-8000-000000000071', 'Craig Menzies', 'craig.menzies@mcrpathways.org', 'MS Coordinator', 'delivery', 'west', 'a0000000-0000-4000-8000-000000000062', 'active', 'staff', 1.0, false, false, false, false, false),
      -- Reports to Amy MacDonald (East Dunbartonshire PM)
      ('a0000000-0000-4000-8000-000000000072', 'Rebecca Fleming', 'rebecca.fleming@mcrpathways.org', 'MS Coordinator', 'delivery', 'west', 'a0000000-0000-4000-8000-000000000063', 'active', 'staff', 1.0, false, false, false, false, false),
      -- Reports to Emma Clark (Inverclyde PM)
      ('a0000000-0000-4000-8000-000000000073', 'Louise Baxter', 'louise.baxter@mcrpathways.org', 'Regional Coordinator', 'delivery', 'west', 'a0000000-0000-4000-8000-000000000064', 'active', 'staff', 1.0, false, false, false, false, false);

    -- West Pathways Outreach Coordinator (reports to Amy MacDonald PM)
    INSERT INTO public.profiles (id, full_name, email, job_title, department, region, line_manager_id, status, user_type, fte, is_line_manager, is_external, is_hr_admin, is_ld_admin, is_systems_admin)
    VALUES
      ('a0000000-0000-4000-8000-000000000074', 'Mark Davidson', 'mark.davidson@mcrpathways.org', 'Pathways Outreach Coordinator', 'delivery', 'west', 'a0000000-0000-4000-8000-000000000063', 'active', 'pathways_coordinator', 1.0, false, false, false, false, false);

    -- West MS Coordinators (report to Senior Partnerships Managers / GCC PMs)
    INSERT INTO public.profiles (id, full_name, email, job_title, department, region, line_manager_id, status, user_type, fte, is_line_manager, is_external, is_hr_admin, is_ld_admin, is_systems_admin)
    VALUES
      -- Reports to Kirsty Hamilton (Senior PM West)
      ('a0000000-0000-4000-8000-000000000075', 'Julie Connolly', 'julie.connolly@mcrpathways.org', 'MS Coordinator', 'delivery', 'west', 'a0000000-0000-4000-8000-000000000065', 'active', 'staff', 1.0, false, false, false, false, false),
      -- Reports to Nicola Johnstone (Senior PM West)
      ('a0000000-0000-4000-8000-000000000076', 'Thomas Rankin', 'thomas.rankin@mcrpathways.org', 'MS Coordinator', 'delivery', 'west', 'a0000000-0000-4000-8000-000000000066', 'active', 'staff', 1.0, false, false, false, false, false),
      -- Reports to Diane Morrison (GCC PM Glasgow)
      ('a0000000-0000-4000-8000-000000000077', 'Patricia Renfrew', 'patricia.renfrew@mcrpathways.org', 'MS Coordinator', 'delivery', 'west', 'a0000000-0000-4000-8000-000000000067', 'active', 'staff', 0.4, false, true, false, false, false);

    -- =========================================
    -- EAST REGION (reports to Development Director)
    -- =========================================

    -- Head of Schools East
    INSERT INTO public.profiles (id, full_name, email, job_title, department, region, line_manager_id, status, user_type, fte, is_line_manager, is_external, is_hr_admin, is_ld_admin, is_systems_admin)
    VALUES
      ('a0000000-0000-4000-8000-000000000080', 'Wendy Sutherland', 'wendy.sutherland@mcrpathways.org', 'Head of Schools (East)', 'delivery', 'east', 'a0000000-0000-4000-8000-000000000005', 'active', 'staff', 1.0, true, false, false, false, false);

    -- East Programme Managers (report to Head of Schools East)
    INSERT INTO public.profiles (id, full_name, email, job_title, department, region, line_manager_id, status, user_type, fte, is_line_manager, is_external, is_hr_admin, is_ld_admin, is_systems_admin)
    VALUES
      ('a0000000-0000-4000-8000-000000000081', 'Ruth Mackenzie', 'ruth.mackenzie@mcrpathways.org', 'Programme Manager', 'delivery', 'east', 'a0000000-0000-4000-8000-000000000080', 'active', 'staff', 1.0, true, false, false, false, false),
      ('a0000000-0000-4000-8000-000000000082', 'Susan Boyd', 'susan.boyd@mcrpathways.org', 'Programme Manager', 'delivery', 'east', 'a0000000-0000-4000-8000-000000000080', 'active', 'staff', 1.0, true, false, false, false, false),
      ('a0000000-0000-4000-8000-000000000083', 'Liam O''Brien', 'liam.obrien@mcrpathways.org', 'Programme Manager', 'delivery', 'east', 'a0000000-0000-4000-8000-000000000080', 'active', 'staff', 1.0, true, false, false, false, false),
      ('a0000000-0000-4000-8000-000000000084', 'Ewan Douglas', 'ewan.douglas@mcrpathways.org', 'Programme Manager', 'delivery', 'east', 'a0000000-0000-4000-8000-000000000080', 'active', 'staff', 1.0, true, false, false, false, false),
      ('a0000000-0000-4000-8000-000000000085', 'Chloe Picken', 'chloe.picken@mcrpathways.org', 'Programme Manager', 'delivery', 'east', 'a0000000-0000-4000-8000-000000000080', 'active', 'staff', 1.0, true, false, false, false, false);

    -- East Senior Partnerships Manager (reports to Head of Schools East — seconded role)
    INSERT INTO public.profiles (id, full_name, email, job_title, department, region, line_manager_id, status, user_type, fte, is_line_manager, is_external, is_hr_admin, is_ld_admin, is_systems_admin)
    VALUES
      ('a0000000-0000-4000-8000-000000000086', 'Mary Buglass', 'mary.buglass@mcrpathways.org', 'Senior Partnerships Manager', 'delivery', 'east', 'a0000000-0000-4000-8000-000000000080', 'active', 'staff', 1.0, true, false, false, false, false);

    -- East Partnerships Manager (reports to Senior Partnerships Manager East)
    INSERT INTO public.profiles (id, full_name, email, job_title, department, region, line_manager_id, status, user_type, fte, is_line_manager, is_external, is_hr_admin, is_ld_admin, is_systems_admin)
    VALUES
      ('a0000000-0000-4000-8000-000000000087', 'Daniel Morris', 'daniel.morris@mcrpathways.org', 'Partnerships Manager', 'delivery', 'east', 'a0000000-0000-4000-8000-000000000086', 'active', 'staff', 1.0, true, false, false, false, false);

    -- East Partnerships sub-team (reports to Daniel Morris)
    INSERT INTO public.profiles (id, full_name, email, job_title, department, region, line_manager_id, status, user_type, fte, is_line_manager, is_external, is_hr_admin, is_ld_admin, is_systems_admin)
    VALUES
      ('a0000000-0000-4000-8000-000000000088', 'Helen Goodey', 'helen.goodey@mcrpathways.org', 'Partnerships & Volunteer Recruitment Coordinator', 'delivery', 'east', 'a0000000-0000-4000-8000-000000000087', 'active', 'staff', 1.0, false, false, false, false, false);

    -- East MS Coordinators (report to their Programme Managers)
    INSERT INTO public.profiles (id, full_name, email, job_title, department, region, line_manager_id, status, user_type, fte, is_line_manager, is_external, is_hr_admin, is_ld_admin, is_systems_admin)
    VALUES
      -- Reports to Ruth Mackenzie (Edinburgh PM)
      ('a0000000-0000-4000-8000-000000000090', 'Alison Whitelaw', 'alison.whitelaw@mcrpathways.org', 'MS Coordinator', 'delivery', 'east', 'a0000000-0000-4000-8000-000000000081', 'active', 'staff', 1.0, false, false, false, false, false),
      -- Reports to Susan Boyd (Fife PM)
      ('a0000000-0000-4000-8000-000000000091', 'Jenna Dempsey', 'jenna.dempsey@mcrpathways.org', 'MS Coordinator', 'delivery', 'east', 'a0000000-0000-4000-8000-000000000082', 'active', 'staff', 0.8, false, false, false, false, false),
      -- Reports to Liam O'Brien (Dundee PM)
      ('a0000000-0000-4000-8000-000000000092', 'Nathan Kelly', 'nathan.kelly@mcrpathways.org', 'MS Coordinator', 'delivery', 'east', 'a0000000-0000-4000-8000-000000000083', 'active', 'staff', 1.0, false, false, false, false, false),
      -- Reports to Ewan Douglas (Perth & Kinross PM)
      ('a0000000-0000-4000-8000-000000000093', 'Andrea Ellis', 'andrea.ellis@mcrpathways.org', 'MS Coordinator', 'delivery', 'east', 'a0000000-0000-4000-8000-000000000084', 'active', 'staff', 1.0, false, false, false, false, false);

    -- East Pathways Coordinators (report to Ewan Douglas - Perth & Kinross PM)
    INSERT INTO public.profiles (id, full_name, email, job_title, department, region, line_manager_id, status, user_type, fte, is_line_manager, is_external, is_hr_admin, is_ld_admin, is_systems_admin)
    VALUES
      ('a0000000-0000-4000-8000-000000000094', 'Gordon Hutton', 'gordon.hutton@mcrpathways.org', 'Pathways Coordinator', 'delivery', 'east', 'a0000000-0000-4000-8000-000000000084', 'active', 'pathways_coordinator', 1.0, false, false, false, false, false),
      ('a0000000-0000-4000-8000-000000000095', 'Priti De Silva', 'priti.desilva@mcrpathways.org', 'Pathways Coordinator', 'delivery', 'east', 'a0000000-0000-4000-8000-000000000084', 'active', 'pathways_coordinator', 1.0, false, false, false, false, false),
      ('a0000000-0000-4000-8000-000000000096', 'Keith Dougall', 'keith.dougall@mcrpathways.org', 'Pathways Coordinator', 'delivery', 'east', 'a0000000-0000-4000-8000-000000000084', 'active', 'pathways_coordinator', 1.0, false, false, false, false, false);

    -- East Pathways Coordinator (reports to Chloe Picken - Forth Valley PM)
    INSERT INTO public.profiles (id, full_name, email, job_title, department, region, line_manager_id, status, user_type, fte, is_line_manager, is_external, is_hr_admin, is_ld_admin, is_systems_admin)
    VALUES
      ('a0000000-0000-4000-8000-000000000097', 'Tanya Reid', 'tanya.reid@mcrpathways.org', 'Pathways Coordinator', 'delivery', 'east', 'a0000000-0000-4000-8000-000000000085', 'active', 'pathways_coordinator', 1.0, false, false, false, false, false);

    -- =========================================
    -- NORTH REGION (reports to Delivery Director)
    -- =========================================

    -- Head of Schools North
    INSERT INTO public.profiles (id, full_name, email, job_title, department, region, line_manager_id, status, user_type, fte, is_line_manager, is_external, is_hr_admin, is_ld_admin, is_systems_admin)
    VALUES
      ('a0000000-0000-4000-8000-000000000100', 'Duncan Jardine', 'duncan.jardine@mcrpathways.org', 'Head of Schools (North)', 'delivery', 'north', 'a0000000-0000-4000-8000-000000000004', 'active', 'staff', 1.0, true, false, false, false, false);

    -- North Programme Manager (reports to Head of Schools North)
    INSERT INTO public.profiles (id, full_name, email, job_title, department, region, line_manager_id, status, user_type, fte, is_line_manager, is_external, is_hr_admin, is_ld_admin, is_systems_admin)
    VALUES
      ('a0000000-0000-4000-8000-000000000101', 'Hazel Lucas', 'hazel.lucas@mcrpathways.org', 'Programme Manager', 'delivery', 'north', 'a0000000-0000-4000-8000-000000000100', 'active', 'staff', 0.8, true, false, false, false, false);

    -- North Partnerships Manager (reports to Head of Schools North)
    INSERT INTO public.profiles (id, full_name, email, job_title, department, region, line_manager_id, status, user_type, fte, is_line_manager, is_external, is_hr_admin, is_ld_admin, is_systems_admin)
    VALUES
      ('a0000000-0000-4000-8000-000000000102', 'Eilidh Fraser', 'eilidh.fraser@mcrpathways.org', 'Partnerships Manager', 'delivery', 'north', 'a0000000-0000-4000-8000-000000000100', 'active', 'staff', 1.0, false, false, false, false, false);

    -- North Community Delivery Lead (reports to Head of Schools North)
    INSERT INTO public.profiles (id, full_name, email, job_title, department, region, line_manager_id, status, user_type, fte, is_line_manager, is_external, is_hr_admin, is_ld_admin, is_systems_admin)
    VALUES
      ('a0000000-0000-4000-8000-000000000103', 'Morag Finnie', 'morag.finnie@mcrpathways.org', 'Community Delivery Lead', 'delivery', 'north', 'a0000000-0000-4000-8000-000000000100', 'active', 'staff', 1.0, true, false, false, false, false);

    -- North Community Delivery sub-team (reports to Morag Finnie)
    INSERT INTO public.profiles (id, full_name, email, job_title, department, region, line_manager_id, status, user_type, fte, is_line_manager, is_external, is_hr_admin, is_ld_admin, is_systems_admin)
    VALUES
      ('a0000000-0000-4000-8000-000000000104', 'Sophie Turnbull', 'sophie.turnbull@mcrpathways.org', 'Aberdeen Young Carers PC', 'delivery', 'north', 'a0000000-0000-4000-8000-000000000103', 'active', 'pathways_coordinator', 1.0, false, false, false, false, false);

    -- North MS Coordinator (reports to Hazel Lucas PM)
    INSERT INTO public.profiles (id, full_name, email, job_title, department, region, line_manager_id, status, user_type, fte, is_line_manager, is_external, is_hr_admin, is_ld_admin, is_systems_admin)
    VALUES
      ('a0000000-0000-4000-8000-000000000105', 'Mairi Brennan', 'mairi.brennan@mcrpathways.org', 'MS Coordinator', 'delivery', 'north', 'a0000000-0000-4000-8000-000000000101', 'active', 'staff', 0.6, false, false, false, false, false);

    -- North Pathways Coordinators (report to Hazel Lucas PM)
    INSERT INTO public.profiles (id, full_name, email, job_title, department, region, line_manager_id, status, user_type, fte, is_line_manager, is_external, is_hr_admin, is_ld_admin, is_systems_admin)
    VALUES
      ('a0000000-0000-4000-8000-000000000106', 'Faye McNeill', 'faye.mcneill@mcrpathways.org', 'Pathways Coordinator', 'delivery', 'north', 'a0000000-0000-4000-8000-000000000101', 'active', 'pathways_coordinator', 0.8, false, false, false, false, false),
      ('a0000000-0000-4000-8000-000000000107', 'Diane Sinclair', 'diane.sinclair@mcrpathways.org', 'Pathways Coordinator', 'delivery', 'north', 'a0000000-0000-4000-8000-000000000101', 'active', 'pathways_coordinator', 1.0, false, false, false, false, false),
      ('a0000000-0000-4000-8000-000000000108', 'Beth Skinner', 'beth.skinner@mcrpathways.org', 'Pathways Coordinator', 'delivery', 'north', 'a0000000-0000-4000-8000-000000000101', 'active', 'pathways_coordinator', 1.0, false, false, false, false, false),
      ('a0000000-0000-4000-8000-000000000109', 'Ross Taylor', 'ross.taylor@mcrpathways.org', 'Pathways Coordinator', 'delivery', 'north', 'a0000000-0000-4000-8000-000000000101', 'active', 'pathways_coordinator', 0.75, false, false, false, false, false),
      ('a0000000-0000-4000-8000-000000000110', 'Fatima Cunningham', 'fatima.cunningham@mcrpathways.org', 'Pathways Coordinator', 'delivery', 'north', 'a0000000-0000-4000-8000-000000000101', 'active', 'pathways_coordinator', 0.56, false, false, false, false, false),
      ('a0000000-0000-4000-8000-000000000111', 'Ian Fraser', 'ian.fraser@mcrpathways.org', 'Pathways Coordinator', 'delivery', 'north', 'a0000000-0000-4000-8000-000000000101', 'active', 'pathways_coordinator', 0.75, false, false, false, false, false),
      ('a0000000-0000-4000-8000-000000000112', 'Cameron Ross', 'cameron.ross@mcrpathways.org', 'Pathways Coordinator', 'delivery', 'north', 'a0000000-0000-4000-8000-000000000101', 'active', 'pathways_coordinator', 0.75, false, false, false, false, false),
      ('a0000000-0000-4000-8000-000000000113', 'Kevin Fowler', 'kevin.fowler@mcrpathways.org', 'Pathways Coordinator', 'delivery', 'north', 'a0000000-0000-4000-8000-000000000101', 'active', 'pathways_coordinator', 0.8, false, false, false, false, false);

    -- =========================================
    -- ENGLAND REGION (reports to Development Director)
    -- =========================================

    -- Head of Schools England
    INSERT INTO public.profiles (id, full_name, email, job_title, department, region, line_manager_id, status, user_type, fte, is_line_manager, is_external, is_hr_admin, is_ld_admin, is_systems_admin)
    VALUES
      ('a0000000-0000-4000-8000-000000000120', 'Angela Fellowes', 'angela.fellowes@mcrpathways.org', 'Head of Schools (England)', 'delivery', 'england', 'a0000000-0000-4000-8000-000000000005', 'active', 'staff', 1.0, true, false, false, false, false);

    -- England direct reports to Head of Schools England
    INSERT INTO public.profiles (id, full_name, email, job_title, department, region, line_manager_id, status, user_type, fte, is_line_manager, is_external, is_hr_admin, is_ld_admin, is_systems_admin)
    VALUES
      ('a0000000-0000-4000-8000-000000000121', 'Charlotte Parkes', 'charlotte.parkes@mcrpathways.org', 'Regional Ops and Events Manager', 'delivery', 'england', 'a0000000-0000-4000-8000-000000000120', 'active', 'staff', 1.0, true, false, false, false, false),
      ('a0000000-0000-4000-8000-000000000122', 'Ben Pentland', 'ben.pentland@mcrpathways.org', 'Programme Manager', 'delivery', 'england', 'a0000000-0000-4000-8000-000000000120', 'active', 'staff', 1.0, true, false, false, false, false),
      ('a0000000-0000-4000-8000-000000000123', 'Anya Masood', 'anya.masood@mcrpathways.org', 'Programme Manager', 'delivery', 'england', 'a0000000-0000-4000-8000-000000000120', 'active', 'staff', 1.0, false, false, false, false, false),
      ('a0000000-0000-4000-8000-000000000124', 'Raj Hundal', 'raj.hundal@mcrpathways.org', 'Programme Manager', 'delivery', 'england', 'a0000000-0000-4000-8000-000000000120', 'active', 'staff', 1.0, false, false, false, false, false);

    -- England Partnerships Managers (report to Head of Schools England)
    INSERT INTO public.profiles (id, full_name, email, job_title, department, region, line_manager_id, status, user_type, fte, is_line_manager, is_external, is_hr_admin, is_ld_admin, is_systems_admin)
    VALUES
      ('a0000000-0000-4000-8000-000000000125', 'Peter Moses', 'peter.moses@mcrpathways.org', 'Partnerships Manager', 'development', 'england', 'a0000000-0000-4000-8000-000000000120', 'active', 'staff', 1.0, false, false, false, false, false),
      ('a0000000-0000-4000-8000-000000000126', 'Samantha Grace', 'samantha.grace@mcrpathways.org', 'Partnerships Manager', 'development', 'england', 'a0000000-0000-4000-8000-000000000120', 'active', 'staff', 1.0, false, false, false, false, false),
      ('a0000000-0000-4000-8000-000000000127', 'Nadia Chalret', 'nadia.chalret@mcrpathways.org', 'Partnerships Manager', 'development', 'england', 'a0000000-0000-4000-8000-000000000120', 'active', 'staff', 1.0, false, false, false, false, false),
      ('a0000000-0000-4000-8000-000000000128', 'Yasmin Aljeffri', 'yasmin.aljeffri@mcrpathways.org', 'Partnerships Manager', 'development', 'england', 'a0000000-0000-4000-8000-000000000120', 'active', 'staff', 1.0, false, false, false, false, false);

    -- England MS Coordinators (report to Charlotte Parkes - Regional Ops Manager)
    INSERT INTO public.profiles (id, full_name, email, job_title, department, region, line_manager_id, status, user_type, fte, is_line_manager, is_external, is_hr_admin, is_ld_admin, is_systems_admin)
    VALUES
      ('a0000000-0000-4000-8000-000000000130', 'Natasha Middleton', 'natasha.middleton@mcrpathways.org', 'MS Coordinator', 'delivery', 'england', 'a0000000-0000-4000-8000-000000000121', 'active', 'staff', 1.0, false, false, false, false, false),
      ('a0000000-0000-4000-8000-000000000131', 'Amy Wenderling', 'amy.wenderling@mcrpathways.org', 'MS Coordinator', 'delivery', 'england', 'a0000000-0000-4000-8000-000000000121', 'active', 'staff', 1.0, false, false, false, false, false),
      ('a0000000-0000-4000-8000-000000000132', 'Tamanna Uddin', 'tamanna.uddin@mcrpathways.org', 'MS Coordinator', 'delivery', 'england', 'a0000000-0000-4000-8000-000000000121', 'active', 'staff', 1.0, false, false, false, false, false);

  END IF;
END $$;
