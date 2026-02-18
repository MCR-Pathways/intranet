-- Migration 00018: Enhance seed courses with real lessons and quiz content
-- Adds text lessons and quiz lessons with questions to the 5 compliance courses.
-- Idempotent: checks for existing lessons before inserting.

DO $$
DECLARE
  v_course_id UUID;
  v_lesson_id UUID;
  v_question_id UUID;
BEGIN

  -- ===========================================
  -- COURSE 1: Data Protection & GDPR
  -- ===========================================
  SELECT id INTO v_course_id FROM public.courses WHERE title = 'Data Protection & GDPR' LIMIT 1;

  IF v_course_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.course_lessons WHERE course_id = v_course_id LIMIT 1
  ) THEN
    -- Lesson 1: Text - What is GDPR?
    INSERT INTO public.course_lessons (course_id, title, content, lesson_type, sort_order, is_active)
    VALUES (
      v_course_id,
      'What is GDPR?',
      'The General Data Protection Regulation (GDPR) is a comprehensive data protection law that governs how personal data is collected, processed, and stored. It applies to all organisations that handle the personal data of individuals within the UK and EU.

At MCR Pathways, we handle sensitive personal data relating to young people, mentors, school staff, and our own employees. This makes GDPR compliance critical to our work.

Key Principles of GDPR:
- Lawfulness, fairness and transparency: Data must be processed lawfully and individuals must be told how their data is used.
- Purpose limitation: Data should only be collected for specified, explicit and legitimate purposes.
- Data minimisation: Only collect data that is necessary for the stated purpose.
- Accuracy: Personal data must be accurate and kept up to date.
- Storage limitation: Data should not be kept longer than necessary.
- Integrity and confidentiality: Data must be processed securely.
- Accountability: Organisations must be able to demonstrate compliance.

As an MCR Pathways employee, you have a responsibility to handle all personal data in accordance with these principles. This includes data about young people in our programmes, their families, school staff, volunteers, and colleagues.',
      'text', 0, TRUE
    ) RETURNING id INTO v_lesson_id;

    -- Lesson 2: Text - Your Responsibilities
    INSERT INTO public.course_lessons (course_id, title, content, lesson_type, sort_order, is_active)
    VALUES (
      v_course_id,
      'Your Data Protection Responsibilities',
      'Every member of staff at MCR Pathways has specific responsibilities when it comes to data protection. Understanding and following these responsibilities helps protect the people we work with and ensures we maintain trust.

Your Key Responsibilities:

1. Only access data you need for your role
Never look up personal information about young people, mentors, or colleagues unless it is directly relevant to your work. Curiosity is not a valid reason to access someone''s records.

2. Keep data secure
Lock your screen when you leave your desk. Never share your login credentials. Use strong, unique passwords. Ensure paper documents containing personal data are stored securely and shredded when no longer needed.

3. Be careful with emails
Double-check the recipient before sending emails containing personal data. Use BCC when emailing groups. Never send sensitive personal data via unencrypted email — use our secure systems instead.

4. Report data breaches immediately
A data breach is any incident where personal data is lost, stolen, or accessed by someone who should not have access. If you suspect a breach, report it to your line manager and the Data Protection Officer immediately. Do not try to fix it yourself.

5. Respect data subject rights
Individuals have the right to access their data, request corrections, and in some cases request deletion. If someone makes such a request, forward it to the Data Protection Officer.

6. Follow the retention schedule
Do not keep personal data longer than necessary. Follow the organisation''s data retention schedule and securely delete or archive data when it is no longer needed.',
      'text', 1, TRUE
    );

    -- Lesson 3: Quiz - GDPR Knowledge Check
    INSERT INTO public.course_lessons (course_id, title, lesson_type, passing_score, sort_order, is_active)
    VALUES (v_course_id, 'GDPR Knowledge Check', 'quiz', 80, 2, TRUE)
    RETURNING id INTO v_lesson_id;

    -- Q1
    INSERT INTO public.quiz_questions (lesson_id, question_text, sort_order)
    VALUES (v_lesson_id, 'Which of the following is NOT a key principle of GDPR?', 0)
    RETURNING id INTO v_question_id;
    INSERT INTO public.quiz_options (question_id, option_text, is_correct, sort_order) VALUES
      (v_question_id, 'Data minimisation', FALSE, 0),
      (v_question_id, 'Profit maximisation', TRUE, 1),
      (v_question_id, 'Accuracy', FALSE, 2),
      (v_question_id, 'Accountability', FALSE, 3);

    -- Q2
    INSERT INTO public.quiz_questions (lesson_id, question_text, sort_order)
    VALUES (v_lesson_id, 'What should you do if you suspect a data breach?', 1)
    RETURNING id INTO v_question_id;
    INSERT INTO public.quiz_options (question_id, option_text, is_correct, sort_order) VALUES
      (v_question_id, 'Try to fix it yourself before telling anyone', FALSE, 0),
      (v_question_id, 'Report it to your line manager and DPO immediately', TRUE, 1),
      (v_question_id, 'Wait to see if anyone notices', FALSE, 2),
      (v_question_id, 'Delete any evidence of the breach', FALSE, 3);

    -- Q3
    INSERT INTO public.quiz_questions (lesson_id, question_text, sort_order)
    VALUES (v_lesson_id, 'When is it acceptable to look up a young person''s personal data?', 2)
    RETURNING id INTO v_question_id;
    INSERT INTO public.quiz_options (question_id, option_text, is_correct, sort_order) VALUES
      (v_question_id, 'Whenever you are curious about their background', FALSE, 0),
      (v_question_id, 'When a colleague asks you to check something', FALSE, 1),
      (v_question_id, 'Only when it is directly relevant to your work duties', TRUE, 2),
      (v_question_id, 'Any time during working hours', FALSE, 3);

    -- Q4
    INSERT INTO public.quiz_questions (lesson_id, question_text, sort_order)
    VALUES (v_lesson_id, 'How should you send sensitive personal data?', 3)
    RETURNING id INTO v_question_id;
    INSERT INTO public.quiz_options (question_id, option_text, is_correct, sort_order) VALUES
      (v_question_id, 'Via regular email to any recipient', FALSE, 0),
      (v_question_id, 'Through the organisation''s secure systems', TRUE, 1),
      (v_question_id, 'By text message', FALSE, 2),
      (v_question_id, 'On social media with restricted privacy settings', FALSE, 3);

    -- Update course to published + active for seed data
    UPDATE public.courses SET status = 'published', is_active = TRUE WHERE id = v_course_id;
  END IF;

  -- ===========================================
  -- COURSE 2: Safeguarding Children & Young People
  -- ===========================================
  SELECT id INTO v_course_id FROM public.courses WHERE title = 'Safeguarding Children & Young People' LIMIT 1;

  IF v_course_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.course_lessons WHERE course_id = v_course_id LIMIT 1
  ) THEN
    -- Lesson 1: Text - What is Safeguarding?
    INSERT INTO public.course_lessons (course_id, title, content, lesson_type, sort_order, is_active)
    VALUES (
      v_course_id,
      'Understanding Safeguarding',
      'Safeguarding means protecting children and young people from harm, abuse, and neglect. At MCR Pathways, safeguarding is everyone''s responsibility — not just those in designated safeguarding roles.

Our work brings us into contact with young people who may be vulnerable. Many of the young people we support face challenges such as care experience, family difficulties, or social disadvantage. This means we must be especially vigilant.

Types of Abuse:
- Physical abuse: Hitting, shaking, burning, or other physical harm.
- Emotional abuse: Persistent emotional ill-treatment causing severe effects on a child''s emotional development.
- Sexual abuse: Forcing or enticing a child to take part in sexual activities.
- Neglect: Persistent failure to meet a child''s basic physical or psychological needs.

Signs to watch for:
- Unexplained injuries or bruises
- Changes in behaviour or mood
- Withdrawal from friends or activities
- Fear of certain adults or places
- Disclosure (telling someone about abuse)
- Poor hygiene or inappropriate clothing for the weather
- Excessive hunger

Remember: It is not your job to decide whether abuse is taking place. Your role is to recognise the signs and report your concerns through the proper channels.',
      'text', 0, TRUE
    );

    -- Lesson 2: Text - Reporting Concerns
    INSERT INTO public.course_lessons (course_id, title, content, lesson_type, sort_order, is_active)
    VALUES (
      v_course_id,
      'How to Report Safeguarding Concerns',
      'If you have a concern about the safety or wellbeing of a young person, you must act on it. Never assume someone else will report it or that it is not serious enough.

The Reporting Process:

1. Listen carefully
If a young person discloses something to you, listen calmly and without judgement. Do not ask leading questions. Let them tell you in their own words. Thank them for telling you.

2. Do not promise confidentiality
You must not promise to keep what they tell you a secret. Explain that you may need to share the information with someone who can help.

3. Record what was said
Write down what the young person told you as soon as possible, using their exact words where you can. Include the date, time, and location. Do not include your opinions — stick to facts.

4. Report to the Designated Safeguarding Lead
Contact the MCR Pathways Designated Safeguarding Lead immediately. If they are unavailable, contact the Deputy Safeguarding Lead or your line manager.

5. Follow up
Ensure your concern has been acknowledged and acted upon. If you feel your concern has not been taken seriously, you can escalate it.

Important Reminders:
- Never investigate allegations yourself
- Never confront the alleged abuser
- Keep the information confidential — only share with those who need to know
- Always follow the organisation''s safeguarding policy
- If a child is in immediate danger, call 999

Contact: MCR Pathways Safeguarding Team — details available on the staff intranet.',
      'text', 1, TRUE
    );

    -- Lesson 3: Quiz - Safeguarding Knowledge Check
    INSERT INTO public.course_lessons (course_id, title, lesson_type, passing_score, sort_order, is_active)
    VALUES (v_course_id, 'Safeguarding Knowledge Check', 'quiz', 80, 2, TRUE)
    RETURNING id INTO v_lesson_id;

    -- Q1
    INSERT INTO public.quiz_questions (lesson_id, question_text, sort_order)
    VALUES (v_lesson_id, 'Whose responsibility is safeguarding at MCR Pathways?', 0)
    RETURNING id INTO v_question_id;
    INSERT INTO public.quiz_options (question_id, option_text, is_correct, sort_order) VALUES
      (v_question_id, 'Only the Designated Safeguarding Lead', FALSE, 0),
      (v_question_id, 'Only staff who work directly with young people', FALSE, 1),
      (v_question_id, 'Everyone in the organisation', TRUE, 2),
      (v_question_id, 'Only line managers', FALSE, 3);

    -- Q2
    INSERT INTO public.quiz_questions (lesson_id, question_text, sort_order)
    VALUES (v_lesson_id, 'If a young person discloses abuse, what should you NOT do?', 1)
    RETURNING id INTO v_question_id;
    INSERT INTO public.quiz_options (question_id, option_text, is_correct, sort_order) VALUES
      (v_question_id, 'Listen calmly', FALSE, 0),
      (v_question_id, 'Promise to keep it a secret', TRUE, 1),
      (v_question_id, 'Record what was said', FALSE, 2),
      (v_question_id, 'Report to the Safeguarding Lead', FALSE, 3);

    -- Q3
    INSERT INTO public.quiz_questions (lesson_id, question_text, sort_order)
    VALUES (v_lesson_id, 'What should you do if a child is in immediate danger?', 2)
    RETURNING id INTO v_question_id;
    INSERT INTO public.quiz_options (question_id, option_text, is_correct, sort_order) VALUES
      (v_question_id, 'Wait until the next working day to report it', FALSE, 0),
      (v_question_id, 'Investigate the situation yourself', FALSE, 1),
      (v_question_id, 'Call 999', TRUE, 2),
      (v_question_id, 'Send an email to your manager', FALSE, 3);

    -- Q4
    INSERT INTO public.quiz_questions (lesson_id, question_text, sort_order)
    VALUES (v_lesson_id, 'Which of the following could be a sign of neglect?', 3)
    RETURNING id INTO v_question_id;
    INSERT INTO public.quiz_options (question_id, option_text, is_correct, sort_order) VALUES
      (v_question_id, 'A child who is always well-dressed', FALSE, 0),
      (v_question_id, 'A child with excessive hunger and poor hygiene', TRUE, 1),
      (v_question_id, 'A child who enjoys coming to school', FALSE, 2),
      (v_question_id, 'A child who has many friends', FALSE, 3);

    UPDATE public.courses SET status = 'published', is_active = TRUE WHERE id = v_course_id;
  END IF;

  -- ===========================================
  -- COURSE 3: Health & Safety Essentials
  -- ===========================================
  SELECT id INTO v_course_id FROM public.courses WHERE title = 'Health & Safety Essentials' LIMIT 1;

  IF v_course_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.course_lessons WHERE course_id = v_course_id LIMIT 1
  ) THEN
    -- Lesson 1: Text - Workplace Health & Safety
    INSERT INTO public.course_lessons (course_id, title, content, lesson_type, sort_order, is_active)
    VALUES (
      v_course_id,
      'Workplace Health & Safety Basics',
      'Health and safety at work is not just a legal requirement — it is about keeping yourself and your colleagues safe. Every employee has a duty to take reasonable care of their own health and safety and that of others.

Your Responsibilities:
- Follow all health and safety policies and procedures
- Report hazards, accidents, and near-misses immediately
- Use equipment and facilities properly
- Attend required health and safety training
- Cooperate with your employer on health and safety matters

Common Workplace Hazards:
1. Slips, trips and falls — Keep walkways clear, clean up spills, report damaged flooring.
2. Display screen equipment (DSE) — Set up your workstation correctly, take regular breaks, adjust your screen height and chair.
3. Manual handling — Use proper lifting techniques, ask for help with heavy items, use trolleys where available.
4. Fire safety — Know your evacuation route, the location of fire exits and extinguishers, and the assembly point.
5. Electrical safety — Do not overload sockets, report damaged cables, and do not use faulty equipment.

Working From Home:
If you work from home, you are still responsible for maintaining a safe workspace. Ensure your workstation is set up ergonomically, take regular breaks, and keep your workspace tidy.',
      'text', 0, TRUE
    );

    -- Lesson 2: Text - Fire Safety & Emergency Procedures
    INSERT INTO public.course_lessons (course_id, title, content, lesson_type, sort_order, is_active)
    VALUES (
      v_course_id,
      'Fire Safety & Emergency Procedures',
      'Fire safety is one of the most critical aspects of workplace health and safety. Every employee must know what to do in the event of a fire or other emergency.

If You Discover a Fire:
1. Raise the alarm immediately by activating the nearest fire alarm call point.
2. Call 999 if the fire brigade has not been called.
3. Do NOT attempt to fight the fire unless it is very small and you are trained to use an extinguisher.
4. Leave the building by the nearest safe exit.
5. Do NOT use lifts.
6. Go directly to the assembly point.

Fire Prevention:
- Keep fire exits and escape routes clear at all times
- Do not prop open fire doors
- Switch off electrical equipment when not in use
- Never leave cooking unattended in kitchen areas
- Report any fire hazards to your manager

First Aid Awareness:
Know where the first aid kits are located and who the trained first aiders are in your workplace. In a medical emergency, call 999 and stay with the person until help arrives. Only perform first aid if you are trained to do so.

Accident Reporting:
All accidents, injuries, and near-misses must be recorded in the accident book. This includes minor incidents. Reporting helps identify patterns and prevent future incidents.',
      'text', 1, TRUE
    );

    -- Lesson 3: Quiz
    INSERT INTO public.course_lessons (course_id, title, lesson_type, passing_score, sort_order, is_active)
    VALUES (v_course_id, 'Health & Safety Quiz', 'quiz', 80, 2, TRUE)
    RETURNING id INTO v_lesson_id;

    -- Q1
    INSERT INTO public.quiz_questions (lesson_id, question_text, sort_order)
    VALUES (v_lesson_id, 'What should you do if you discover a fire?', 0)
    RETURNING id INTO v_question_id;
    INSERT INTO public.quiz_options (question_id, option_text, is_correct, sort_order) VALUES
      (v_question_id, 'Try to put it out with water', FALSE, 0),
      (v_question_id, 'Raise the alarm immediately', TRUE, 1),
      (v_question_id, 'Finish what you were doing first', FALSE, 2),
      (v_question_id, 'Take the lift to the ground floor', FALSE, 3);

    -- Q2
    INSERT INTO public.quiz_questions (lesson_id, question_text, sort_order)
    VALUES (v_lesson_id, 'Which of the following is a common workplace hazard?', 1)
    RETURNING id INTO v_question_id;
    INSERT INTO public.quiz_options (question_id, option_text, is_correct, sort_order) VALUES
      (v_question_id, 'Taking regular breaks', FALSE, 0),
      (v_question_id, 'Overloaded electrical sockets', TRUE, 1),
      (v_question_id, 'Attending team meetings', FALSE, 2),
      (v_question_id, 'Using a standing desk', FALSE, 3);

    -- Q3
    INSERT INTO public.quiz_questions (lesson_id, question_text, sort_order)
    VALUES (v_lesson_id, 'When should you report a near-miss?', 2)
    RETURNING id INTO v_question_id;
    INSERT INTO public.quiz_options (question_id, option_text, is_correct, sort_order) VALUES
      (v_question_id, 'Only if someone was injured', FALSE, 0),
      (v_question_id, 'Only if your manager asks about it', FALSE, 1),
      (v_question_id, 'Always — all near-misses should be reported', TRUE, 2),
      (v_question_id, 'Only if it happens more than once', FALSE, 3);

    UPDATE public.courses SET status = 'published', is_active = TRUE WHERE id = v_course_id;
  END IF;

  -- ===========================================
  -- COURSE 4: Equality, Diversity & Inclusion
  -- ===========================================
  SELECT id INTO v_course_id FROM public.courses WHERE title = 'Equality, Diversity & Inclusion' LIMIT 1;

  IF v_course_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.course_lessons WHERE course_id = v_course_id LIMIT 1
  ) THEN
    -- Lesson 1: Text - Understanding EDI
    INSERT INTO public.course_lessons (course_id, title, content, lesson_type, sort_order, is_active)
    VALUES (
      v_course_id,
      'Equality, Diversity & Inclusion at MCR Pathways',
      'MCR Pathways is committed to creating an inclusive environment where everyone is treated with dignity and respect. This applies to our staff, volunteers, the young people we support, and everyone we work with.

Key Concepts:

Equality means ensuring everyone has fair access to opportunities. It does not mean treating everyone the same — it means recognising that different people may need different support to achieve the same outcomes.

Diversity refers to the range of differences between people, including but not limited to age, disability, gender, race, religion, sexual orientation, and socioeconomic background.

Inclusion means creating an environment where everyone feels valued, respected, and able to participate fully.

Protected Characteristics:
Under the Equality Act 2010, it is unlawful to discriminate against someone because of:
- Age
- Disability
- Gender reassignment
- Marriage and civil partnership
- Pregnancy and maternity
- Race
- Religion or belief
- Sex
- Sexual orientation

At MCR Pathways, we go beyond legal compliance. We actively work to dismantle barriers and create opportunities for young people who face disadvantage. Understanding EDI helps us do this work effectively and authentically.',
      'text', 0, TRUE
    );

    -- Lesson 2: Text - Unconscious Bias
    INSERT INTO public.course_lessons (course_id, title, content, lesson_type, sort_order, is_active)
    VALUES (
      v_course_id,
      'Understanding Unconscious Bias',
      'Unconscious bias refers to the automatic judgements and assumptions we make about people based on characteristics like their appearance, name, accent, or background. Everyone has unconscious biases — they are a natural part of how our brains process information.

However, when left unchecked, unconscious bias can lead to unfair treatment, poor decision-making, and exclusion. In our work at MCR Pathways, bias can affect how we interact with young people, which mentors we match them with, and the opportunities we provide.

Common Types of Unconscious Bias:
- Affinity bias: Favouring people who are similar to us.
- Confirmation bias: Looking for information that confirms our existing beliefs about someone.
- Halo effect: Letting one positive trait influence our overall judgement of a person.
- Horn effect: Letting one negative trait overshadow everything else about a person.
- Attribution bias: Attributing someone''s behaviour to their character rather than their circumstances.

How to Manage Unconscious Bias:
1. Acknowledge that you have biases — everyone does.
2. Slow down your decision-making — quick judgements are more likely to be biased.
3. Seek out diverse perspectives — listen to people with different backgrounds and experiences.
4. Challenge stereotypes when you notice them — in yourself and others.
5. Use structured processes for decisions — such as interview scoring frameworks and matching criteria.
6. Reflect regularly on your interactions — ask yourself whether you would have responded differently to someone of a different background.',
      'text', 1, TRUE
    );

    -- Lesson 3: Quiz
    INSERT INTO public.course_lessons (course_id, title, lesson_type, passing_score, sort_order, is_active)
    VALUES (v_course_id, 'EDI Knowledge Check', 'quiz', 80, 2, TRUE)
    RETURNING id INTO v_lesson_id;

    -- Q1
    INSERT INTO public.quiz_questions (lesson_id, question_text, sort_order)
    VALUES (v_lesson_id, 'What does equality mean in the context of EDI?', 0)
    RETURNING id INTO v_question_id;
    INSERT INTO public.quiz_options (question_id, option_text, is_correct, sort_order) VALUES
      (v_question_id, 'Treating everyone exactly the same', FALSE, 0),
      (v_question_id, 'Ensuring everyone has fair access to opportunities', TRUE, 1),
      (v_question_id, 'Giving everyone the same salary', FALSE, 2),
      (v_question_id, 'Making sure everyone agrees', FALSE, 3);

    -- Q2
    INSERT INTO public.quiz_questions (lesson_id, question_text, sort_order)
    VALUES (v_lesson_id, 'Which of the following is an example of unconscious bias?', 1)
    RETURNING id INTO v_question_id;
    INSERT INTO public.quiz_options (question_id, option_text, is_correct, sort_order) VALUES
      (v_question_id, 'Deliberately refusing to hire someone because of their age', FALSE, 0),
      (v_question_id, 'Automatically assuming someone is less capable because of their accent', TRUE, 1),
      (v_question_id, 'Following a structured interview process', FALSE, 2),
      (v_question_id, 'Asking for diverse perspectives in a meeting', FALSE, 3);

    -- Q3
    INSERT INTO public.quiz_questions (lesson_id, question_text, sort_order)
    VALUES (v_lesson_id, 'How many protected characteristics are there under the Equality Act 2010?', 2)
    RETURNING id INTO v_question_id;
    INSERT INTO public.quiz_options (question_id, option_text, is_correct, sort_order) VALUES
      (v_question_id, '5', FALSE, 0),
      (v_question_id, '7', FALSE, 1),
      (v_question_id, '9', TRUE, 2),
      (v_question_id, '12', FALSE, 3);

    UPDATE public.courses SET status = 'published', is_active = TRUE WHERE id = v_course_id;
  END IF;

  -- ===========================================
  -- COURSE 5: Information Security Awareness
  -- ===========================================
  SELECT id INTO v_course_id FROM public.courses WHERE title = 'Information Security Awareness' LIMIT 1;

  IF v_course_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.course_lessons WHERE course_id = v_course_id LIMIT 1
  ) THEN
    -- Lesson 1: Text - Information Security Basics
    INSERT INTO public.course_lessons (course_id, title, content, lesson_type, sort_order, is_active)
    VALUES (
      v_course_id,
      'Information Security Fundamentals',
      'Information security is about protecting sensitive data from unauthorised access, use, disclosure, disruption, or destruction. At MCR Pathways, we handle sensitive information about young people, schools, and staff that must be protected.

Key Areas of Information Security:

Password Security:
- Use strong, unique passwords for each account (at least 12 characters with a mix of letters, numbers, and symbols)
- Never share your passwords with anyone
- Use a password manager to keep track of passwords
- Enable multi-factor authentication (MFA) wherever possible
- Change your password immediately if you think it has been compromised

Email Security:
- Be cautious of unexpected emails, especially those asking you to click links or open attachments
- Check the sender''s email address carefully — phishing emails often use addresses that look similar to legitimate ones
- Never send sensitive data via unencrypted email
- Report suspicious emails to the IT team

Device Security:
- Lock your computer when you leave your desk (Windows: Win+L, Mac: Cmd+Ctrl+Q)
- Keep your software and operating system up to date
- Do not install unauthorised software
- Use the organisation''s VPN when working remotely
- Never leave devices unattended in public places',
      'text', 0, TRUE
    );

    -- Lesson 2: Text - Phishing & Social Engineering
    INSERT INTO public.course_lessons (course_id, title, content, lesson_type, sort_order, is_active)
    VALUES (
      v_course_id,
      'Recognising Phishing & Social Engineering',
      'Phishing and social engineering are the most common ways that attackers try to gain access to sensitive information. Understanding how these attacks work is your best defence.

What is Phishing?
Phishing is when an attacker sends a fraudulent message (usually email) designed to trick you into revealing sensitive information or clicking a malicious link. Phishing emails often create a sense of urgency or impersonate someone you trust.

Red Flags to Watch For:
- Unexpected emails asking you to act urgently
- Requests for passwords, personal information, or payment
- Email addresses that do not quite match the supposed sender
- Poor grammar or spelling
- Links that go to unfamiliar websites (hover over links to check before clicking)
- Attachments you were not expecting

What is Social Engineering?
Social engineering is a broader term for manipulating people into giving up information or access. This can happen via phone calls, in person, or through social media — not just email.

Examples:
- Someone calling and pretending to be from IT support, asking for your password
- A person following you through a secure door without badging in (tailgating)
- A message on social media from someone posing as a colleague

What to Do:
- If something feels wrong, trust your instincts
- Verify requests through a separate channel (e.g., call the person back on a known number)
- Never give out your password, even to IT support
- Report all suspected phishing to the IT team immediately',
      'text', 1, TRUE
    );

    -- Lesson 3: Quiz
    INSERT INTO public.course_lessons (course_id, title, lesson_type, passing_score, sort_order, is_active)
    VALUES (v_course_id, 'Information Security Quiz', 'quiz', 80, 2, TRUE)
    RETURNING id INTO v_lesson_id;

    -- Q1
    INSERT INTO public.quiz_questions (lesson_id, question_text, sort_order)
    VALUES (v_lesson_id, 'What is the recommended minimum password length?', 0)
    RETURNING id INTO v_question_id;
    INSERT INTO public.quiz_options (question_id, option_text, is_correct, sort_order) VALUES
      (v_question_id, '6 characters', FALSE, 0),
      (v_question_id, '8 characters', FALSE, 1),
      (v_question_id, '12 characters', TRUE, 2),
      (v_question_id, '4 characters', FALSE, 3);

    -- Q2
    INSERT INTO public.quiz_questions (lesson_id, question_text, sort_order)
    VALUES (v_lesson_id, 'Which of the following is a sign of a phishing email?', 1)
    RETURNING id INTO v_question_id;
    INSERT INTO public.quiz_options (question_id, option_text, is_correct, sort_order) VALUES
      (v_question_id, 'An email from a known colleague about a scheduled meeting', FALSE, 0),
      (v_question_id, 'An urgent request to click a link and verify your account', TRUE, 1),
      (v_question_id, 'A newsletter you subscribed to', FALSE, 2),
      (v_question_id, 'An automated calendar reminder', FALSE, 3);

    -- Q3
    INSERT INTO public.quiz_questions (lesson_id, question_text, sort_order)
    VALUES (v_lesson_id, 'Someone calls claiming to be from IT and asks for your password. What should you do?', 2)
    RETURNING id INTO v_question_id;
    INSERT INTO public.quiz_options (question_id, option_text, is_correct, sort_order) VALUES
      (v_question_id, 'Give them your password — they need it to fix your account', FALSE, 0),
      (v_question_id, 'Ask them to send you an email instead', FALSE, 1),
      (v_question_id, 'Refuse and report the call — legitimate IT support never asks for passwords', TRUE, 2),
      (v_question_id, 'Give them a fake password', FALSE, 3);

    -- Q4
    INSERT INTO public.quiz_questions (lesson_id, question_text, sort_order)
    VALUES (v_lesson_id, 'What should you do before clicking a link in an email?', 3)
    RETURNING id INTO v_question_id;
    INSERT INTO public.quiz_options (question_id, option_text, is_correct, sort_order) VALUES
      (v_question_id, 'Click it quickly to save time', FALSE, 0),
      (v_question_id, 'Hover over the link to check where it goes', TRUE, 1),
      (v_question_id, 'Forward the email to all colleagues for advice', FALSE, 2),
      (v_question_id, 'Reply to the sender asking if it is safe', FALSE, 3);

    UPDATE public.courses SET status = 'published', is_active = TRUE WHERE id = v_course_id;
  END IF;

END $$;
