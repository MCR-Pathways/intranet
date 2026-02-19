-- Migration 00021: Delete empty shell and test courses, seed new courses with content
-- Part A: Deletes 13 unwanted courses (7 empty shells + 6 test courses).
--   FK ON DELETE CASCADE handles all child data (enrollments, lessons, quizzes, attempts, images, assignments).
-- Part B: Seeds 7 new upskilling/soft_skills courses with text lessons and quizzes.
-- Idempotent: DELETEs are no-ops if rows don't exist; INSERTs check IF NOT EXISTS.

-- ============================================
-- PART A: Delete unwanted courses
-- ============================================

-- 7 empty shell courses (seeded in migration 00004, no lesson content)
DELETE FROM public.courses WHERE title = 'Effective Mentoring Techniques';
DELETE FROM public.courses WHERE title = 'Communication Skills for Coordinators';
DELETE FROM public.courses WHERE title = 'Time Management & Productivity';
DELETE FROM public.courses WHERE title = 'Trauma-Informed Practice';
DELETE FROM public.courses WHERE title = 'Presentation Skills';
DELETE FROM public.courses WHERE title = 'Conflict Resolution';
DELETE FROM public.courses WHERE title = 'Emotional Intelligence in the Workplace';

-- 6 test courses (created during QA testing)
DELETE FROM public.courses WHERE title LIKE '[TEST]%';
DELETE FROM public.courses WHERE title = 'Learning Features Test Course';
DELETE FROM public.courses WHERE title = 'QA Test Course';
DELETE FROM public.courses WHERE title = 'Resume Test Course';
DELETE FROM public.courses WHERE title = 'Preview Test Course';

-- Clean up orphaned notifications referencing deleted courses
DELETE FROM public.notifications
WHERE metadata->>'course_id' IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.courses WHERE id = (metadata->>'course_id')::UUID
  );


-- ============================================
-- PART B: Seed 7 new courses with content
-- ============================================

-- ===========================================
-- COURSE 1: Effective Mentoring Techniques (Upskilling)
-- ===========================================
DO $$
DECLARE
  v_course_id UUID;
  v_lesson_id UUID;
  v_question_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.courses WHERE title = 'Effective Mentoring Techniques') THEN
    INSERT INTO public.courses (title, description, category, duration_minutes, is_required, status, is_active)
    VALUES (
      'Effective Mentoring Techniques',
      'Learn strategies and techniques for building strong, supportive mentoring relationships with young people.',
      'upskilling', 60, FALSE, 'published', TRUE
    ) RETURNING id INTO v_course_id;

    -- Lesson 1: Text - Foundations of Mentoring
    INSERT INTO public.course_lessons (course_id, title, content, lesson_type, sort_order, is_active)
    VALUES (
      v_course_id,
      'Foundations of Effective Mentoring',
      'Mentoring is at the heart of what MCR Pathways does. A good mentoring relationship can transform a young person''s life, providing them with consistent support, encouragement, and a trusted adult who believes in them.

What Makes a Good Mentor?

A good mentor is not someone who has all the answers. Rather, they are someone who listens well, shows genuine interest, and helps the young person develop their own strengths and solutions.

Key qualities of an effective mentor:
- Active listening: Give your full attention. Put away your phone, make eye contact, and show that you are genuinely interested in what the young person is saying.
- Reliability: Be consistent. Turn up when you say you will. Young people who have experienced instability need to know they can count on you.
- Patience: Progress may be slow and non-linear. Celebrate small wins and do not expect immediate change.
- Empathy: Try to understand the young person''s perspective, even when their behaviour is challenging.
- Boundaries: Maintain appropriate professional boundaries while still being warm and approachable.

The Mentoring Cycle:

1. Building rapport: The first few sessions are about getting to know each other. Focus on finding common ground and making the young person feel comfortable.
2. Setting goals: Work together to identify what the young person wants to achieve. Goals should be realistic and meaningful to them.
3. Working together: Support the young person in taking steps towards their goals. Encourage independence rather than doing things for them.
4. Reviewing progress: Regularly reflect on what is going well and what could be improved.
5. Ending well: When the mentoring relationship comes to a natural end, acknowledge what has been achieved and ensure the young person feels positive about the experience.',
      'text', 0, TRUE
    );

    -- Lesson 2: Text - Practical Mentoring Skills
    INSERT INTO public.course_lessons (course_id, title, content, lesson_type, sort_order, is_active)
    VALUES (
      v_course_id,
      'Practical Mentoring Skills',
      'This lesson covers practical techniques you can use in your mentoring sessions to build trust, encourage reflection, and support the young person''s development.

Asking Good Questions:

The questions you ask can make a big difference to the quality of a mentoring conversation. Open questions encourage the young person to think and share more than closed questions.

Instead of: "Did you have a good week?" (closed — invites yes/no)
Try: "What was the best part of your week?" (open — invites reflection)

Instead of: "Are you worried about your exams?" (closed)
Try: "How are you feeling about your exams coming up?" (open)

Other useful question starters:
- "Tell me about..."
- "What do you think would happen if..."
- "How did that make you feel?"
- "What would you like to do differently next time?"

Active Listening Techniques:

- Reflecting: Repeat back what the young person said in your own words to show you understood. "So it sounds like you felt left out when..."
- Summarising: At the end of a topic, briefly summarise the key points. "So this week you''ve been dealing with..."
- Validating: Acknowledge their feelings. "That sounds really frustrating" or "It makes sense that you feel that way."
- Silence: Do not rush to fill silences. Sometimes the young person needs time to think.

Handling Difficult Conversations:

- Stay calm and non-judgmental, even if you hear something shocking.
- Do not offer advice unless asked. Instead, help the young person explore their options.
- If safeguarding concerns arise, follow the reporting procedures covered in your safeguarding training.
- It is okay to say "I don''t know" — honesty builds trust.

Session Planning:

Having a rough plan for each session helps, but be flexible. A simple structure might be:
1. Check-in: How has the week been? (5 minutes)
2. Main activity or conversation: Work on goals or discuss something important. (20 minutes)
3. Wrap-up: What are the key takeaways? What will you focus on before next time? (5 minutes)',
      'text', 1, TRUE
    );

    -- Lesson 3: Quiz
    INSERT INTO public.course_lessons (course_id, title, lesson_type, passing_score, sort_order, is_active)
    VALUES (v_course_id, 'Mentoring Knowledge Check', 'quiz', 80, 2, TRUE)
    RETURNING id INTO v_lesson_id;

    -- Q1
    INSERT INTO public.quiz_questions (lesson_id, question_text, sort_order)
    VALUES (v_lesson_id, 'Which of the following is a key quality of an effective mentor?', 0)
    RETURNING id INTO v_question_id;
    INSERT INTO public.quiz_options (question_id, option_text, is_correct, sort_order) VALUES
      (v_question_id, 'Having all the answers to the young person''s problems', FALSE, 0),
      (v_question_id, 'Being reliable and consistent', TRUE, 1),
      (v_question_id, 'Solving problems for the young person', FALSE, 2),
      (v_question_id, 'Sharing personal stories as much as possible', FALSE, 3);

    -- Q2
    INSERT INTO public.quiz_questions (lesson_id, question_text, sort_order)
    VALUES (v_lesson_id, 'What type of question is most effective in mentoring conversations?', 1)
    RETURNING id INTO v_question_id;
    INSERT INTO public.quiz_options (question_id, option_text, is_correct, sort_order) VALUES
      (v_question_id, 'Closed questions that can be answered with yes or no', FALSE, 0),
      (v_question_id, 'Leading questions that guide the young person to a specific answer', FALSE, 1),
      (v_question_id, 'Open questions that encourage the young person to think and share', TRUE, 2),
      (v_question_id, 'Rapid-fire questions to keep the conversation moving', FALSE, 3);

    -- Q3
    INSERT INTO public.quiz_questions (lesson_id, question_text, sort_order)
    VALUES (v_lesson_id, 'What should you do if a young person shares something that raises safeguarding concerns?', 2)
    RETURNING id INTO v_question_id;
    INSERT INTO public.quiz_options (question_id, option_text, is_correct, sort_order) VALUES
      (v_question_id, 'Promise to keep it confidential', FALSE, 0),
      (v_question_id, 'Investigate the situation yourself', FALSE, 1),
      (v_question_id, 'Follow the safeguarding reporting procedures', TRUE, 2),
      (v_question_id, 'Discuss it with other mentors for advice', FALSE, 3);

    -- Q4
    INSERT INTO public.quiz_questions (lesson_id, question_text, sort_order)
    VALUES (v_lesson_id, 'What is the purpose of the "reflecting" listening technique?', 3)
    RETURNING id INTO v_question_id;
    INSERT INTO public.quiz_options (question_id, option_text, is_correct, sort_order) VALUES
      (v_question_id, 'To correct what the young person said', FALSE, 0),
      (v_question_id, 'To show the young person you understood what they said', TRUE, 1),
      (v_question_id, 'To change the subject', FALSE, 2),
      (v_question_id, 'To fill silence in the conversation', FALSE, 3);
  END IF;
END $$;


-- ===========================================
-- COURSE 2: Trauma-Informed Practice (Upskilling)
-- ===========================================
DO $$
DECLARE
  v_course_id UUID;
  v_lesson_id UUID;
  v_question_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.courses WHERE title = 'Trauma-Informed Practice') THEN
    INSERT INTO public.courses (title, description, category, duration_minutes, is_required, status, is_active)
    VALUES (
      'Trauma-Informed Practice',
      'Understanding trauma and its impact on young people, with practical strategies for providing sensitive support.',
      'upskilling', 75, FALSE, 'published', TRUE
    ) RETURNING id INTO v_course_id;

    -- Lesson 1: Text - Understanding Trauma
    INSERT INTO public.course_lessons (course_id, title, content, lesson_type, sort_order, is_active)
    VALUES (
      v_course_id,
      'Understanding Trauma and Its Impact',
      'Many of the young people MCR Pathways supports have experienced some form of trauma. Understanding what trauma is and how it affects behaviour, learning, and development is essential for everyone in the organisation.

What is Trauma?

Trauma is the emotional and psychological response to deeply distressing events or experiences. For young people, this can include:
- Adverse childhood experiences (ACEs) such as abuse, neglect, or household dysfunction
- Bereavement or loss of a significant person
- Witnessing domestic violence
- Experiencing bullying or discrimination
- Being in care or experiencing multiple placement changes
- Parental substance misuse or mental health difficulties

How Trauma Affects the Brain:

When a young person experiences trauma, their brain''s stress response system can become dysregulated. This means they may be in a constant state of alertness (hypervigilance) or may shut down emotionally (dissociation).

Key effects include:
- Difficulty concentrating and learning
- Heightened emotional reactions (anger, anxiety, withdrawal)
- Challenges forming trusting relationships
- Low self-esteem and negative self-image
- Physical symptoms such as headaches, stomach aches, and fatigue
- Difficulty regulating emotions and behaviour

Understanding the Window of Tolerance:

Everyone has a "window of tolerance" — a zone where they can manage stress and engage effectively. Trauma narrows this window, meaning young people may more easily become overwhelmed (hyperarousal) or shut down (hypoarousal).

Hyperarousal signs: agitation, anger outbursts, inability to sit still, anxiety
Hypoarousal signs: withdrawal, zoning out, appearing disconnected, flat affect

Our role is to help young people stay within or return to their window of tolerance through safe, predictable, and supportive interactions.',
      'text', 0, TRUE
    );

    -- Lesson 2: Text - Trauma-Informed Approaches
    INSERT INTO public.course_lessons (course_id, title, content, lesson_type, sort_order, is_active)
    VALUES (
      v_course_id,
      'Applying Trauma-Informed Approaches',
      'Being trauma-informed does not mean being a therapist. It means understanding how trauma affects people and adjusting your approach to avoid re-traumatisation and promote healing.

The Five Principles of Trauma-Informed Practice:

1. Safety: Create environments where young people feel physically and emotionally safe. This includes being predictable, calm, and consistent in your interactions.

2. Trustworthiness: Be honest and transparent. Follow through on commitments. Build trust gradually — do not expect it immediately.

3. Choice: Give young people meaningful choices wherever possible. Trauma often involves a loss of control, so restoring choice is powerful.

4. Collaboration: Work with young people, not on them. Involve them in decisions about their support.

5. Empowerment: Focus on strengths rather than deficits. Help young people recognise their own resilience and capabilities.

Practical Strategies:

Regulating your own emotions: You cannot help a young person regulate if you are dysregulated yourself. Take deep breaths, stay calm, and model the behaviour you want to see.

Using co-regulation: When a young person is distressed, your calm presence can help them regulate. Speak softly, give them space if needed, and wait for them to feel safe before trying to problem-solve.

Avoiding triggers: Be aware that certain situations, topics, or environments may trigger trauma responses. Check in with the young person and adjust your approach.

Reframing behaviour: Instead of asking "What is wrong with you?" ask "What happened to you?" Challenging behaviour is often a survival response, not defiance.

Looking after yourself: Working with young people who have experienced trauma can be emotionally demanding. Make sure you access supervision, talk to colleagues, and take care of your own wellbeing. Recognising vicarious trauma in yourself is a sign of strength, not weakness.',
      'text', 1, TRUE
    );

    -- Lesson 3: Quiz
    INSERT INTO public.course_lessons (course_id, title, lesson_type, passing_score, sort_order, is_active)
    VALUES (v_course_id, 'Trauma-Informed Practice Quiz', 'quiz', 80, 2, TRUE)
    RETURNING id INTO v_lesson_id;

    -- Q1
    INSERT INTO public.quiz_questions (lesson_id, question_text, sort_order)
    VALUES (v_lesson_id, 'What is the "window of tolerance"?', 0)
    RETURNING id INTO v_question_id;
    INSERT INTO public.quiz_options (question_id, option_text, is_correct, sort_order) VALUES
      (v_question_id, 'The maximum time a young person can concentrate', FALSE, 0),
      (v_question_id, 'The zone where a person can manage stress and engage effectively', TRUE, 1),
      (v_question_id, 'The amount of misbehaviour a teacher will accept', FALSE, 2),
      (v_question_id, 'A therapy technique used by counsellors', FALSE, 3);

    -- Q2
    INSERT INTO public.quiz_questions (lesson_id, question_text, sort_order)
    VALUES (v_lesson_id, 'Which of these is a principle of trauma-informed practice?', 1)
    RETURNING id INTO v_question_id;
    INSERT INTO public.quiz_options (question_id, option_text, is_correct, sort_order) VALUES
      (v_question_id, 'Punishment for negative behaviour', FALSE, 0),
      (v_question_id, 'Avoiding all difficult conversations', FALSE, 1),
      (v_question_id, 'Giving young people meaningful choices', TRUE, 2),
      (v_question_id, 'Expecting immediate trust from young people', FALSE, 3);

    -- Q3
    INSERT INTO public.quiz_questions (lesson_id, question_text, sort_order)
    VALUES (v_lesson_id, 'Instead of asking "What is wrong with you?" a trauma-informed approach asks:', 2)
    RETURNING id INTO v_question_id;
    INSERT INTO public.quiz_options (question_id, option_text, is_correct, sort_order) VALUES
      (v_question_id, '"Why can''t you behave?"', FALSE, 0),
      (v_question_id, '"What happened to you?"', TRUE, 1),
      (v_question_id, '"What do you want me to do about it?"', FALSE, 2),
      (v_question_id, '"Have you tried calming down?"', FALSE, 3);

    -- Q4
    INSERT INTO public.quiz_questions (lesson_id, question_text, sort_order)
    VALUES (v_lesson_id, 'What is co-regulation?', 3)
    RETURNING id INTO v_question_id;
    INSERT INTO public.quiz_options (question_id, option_text, is_correct, sort_order) VALUES
      (v_question_id, 'Telling a young person to calm down', FALSE, 0),
      (v_question_id, 'Using your own calm presence to help a distressed young person regulate', TRUE, 1),
      (v_question_id, 'Two young people helping each other with homework', FALSE, 2),
      (v_question_id, 'A formal mediation process between two people in conflict', FALSE, 3);
  END IF;
END $$;


-- ===========================================
-- COURSE 3: Communication Skills for Coordinators (Upskilling)
-- ===========================================
DO $$
DECLARE
  v_course_id UUID;
  v_lesson_id UUID;
  v_question_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.courses WHERE title = 'Communication Skills for Coordinators') THEN
    INSERT INTO public.courses (title, description, category, duration_minutes, is_required, status, is_active)
    VALUES (
      'Communication Skills for Coordinators',
      'Enhance your communication skills for working with schools, young people, mentors, and partner organisations.',
      'upskilling', 45, FALSE, 'published', TRUE
    ) RETURNING id INTO v_course_id;

    -- Lesson 1: Text - Communication Fundamentals
    INSERT INTO public.course_lessons (course_id, title, content, lesson_type, sort_order, is_active)
    VALUES (
      v_course_id,
      'Communication Fundamentals for Your Role',
      'As an MCR Pathways coordinator, you are the bridge between young people, mentors, schools, and the wider organisation. Strong communication skills are essential for building relationships, managing expectations, and ensuring everyone is working together effectively.

Key Communication Channels:

1. Face-to-face conversations: The most effective way to build rapport and discuss sensitive topics. Use active listening, maintain eye contact, and give your full attention.

2. Email: Use for formal communications, scheduling, and sharing information. Keep emails clear and concise. Use bullet points for action items. Always proofread before sending.

3. Phone calls: Useful for quick check-ins and when email is too slow. Be prepared with key points before calling. Follow up important calls with a written summary.

4. Team meetings: Come prepared with an agenda. Encourage participation from all attendees. Summarise decisions and action items at the end.

Communicating with Different Audiences:

With young people:
- Use clear, simple language
- Be warm and approachable
- Check for understanding
- Be patient and give them time to respond

With school staff:
- Be professional and respectful of their time
- Understand the school context and pressures
- Provide clear, actionable information about the young people you support
- Celebrate successes together

With mentors:
- Be supportive and encouraging
- Provide clear guidance about expectations and boundaries
- Listen to their concerns and provide constructive feedback
- Recognise their contribution

With colleagues and managers:
- Be open and honest about challenges
- Share successes and learning
- Ask for support when you need it
- Contribute positively to team discussions',
      'text', 0, TRUE
    );

    -- Lesson 2: Text - Advanced Communication
    INSERT INTO public.course_lessons (course_id, title, content, lesson_type, sort_order, is_active)
    VALUES (
      v_course_id,
      'Advanced Communication Techniques',
      'This lesson covers more advanced communication skills that will help you navigate complex situations and have more productive conversations.

Having Difficult Conversations:

Difficult conversations are unavoidable in coordinating roles. Whether it is addressing a concern with a school, giving feedback to a mentor, or discussing a sensitive issue with a young person, preparation is key.

The STAR framework for difficult conversations:
- Situation: Describe the specific situation objectively.
- Task: Explain what was expected or needed.
- Action: Describe what actually happened (without blame).
- Result: Discuss the impact and agree on next steps.

Tips for difficult conversations:
- Choose the right time and place — never have a difficult conversation in a rush or in front of others.
- Start with something positive before raising the concern.
- Use "I" statements: "I noticed..." rather than "You always..."
- Focus on behaviour, not personality.
- Listen to the other person''s perspective before responding.
- Agree on clear next steps.

De-escalation Techniques:

When emotions run high, de-escalation can prevent a situation from getting worse:
- Stay calm and speak slowly in a low, steady tone.
- Acknowledge the person''s feelings: "I can see this is really frustrating for you."
- Give the person space — do not crowd them.
- Avoid arguing or defending yourself in the moment.
- Offer a break: "Would it help to take five minutes and come back to this?"

Written Communication Best Practices:

- Be clear about the purpose of your message in the first sentence.
- Use headings and bullet points for longer communications.
- Avoid jargon — not everyone understands MCR-specific terminology.
- Be mindful of tone — written messages can be misread. When in doubt, pick up the phone.
- Respect confidentiality — never include personal details about young people in group emails.',
      'text', 1, TRUE
    );

    -- Lesson 3: Quiz
    INSERT INTO public.course_lessons (course_id, title, lesson_type, passing_score, sort_order, is_active)
    VALUES (v_course_id, 'Communication Skills Quiz', 'quiz', 80, 2, TRUE)
    RETURNING id INTO v_lesson_id;

    -- Q1
    INSERT INTO public.quiz_questions (lesson_id, question_text, sort_order)
    VALUES (v_lesson_id, 'What does the "S" in the STAR framework stand for?', 0)
    RETURNING id INTO v_question_id;
    INSERT INTO public.quiz_options (question_id, option_text, is_correct, sort_order) VALUES
      (v_question_id, 'Solution', FALSE, 0),
      (v_question_id, 'Situation', TRUE, 1),
      (v_question_id, 'Strategy', FALSE, 2),
      (v_question_id, 'Summary', FALSE, 3);

    -- Q2
    INSERT INTO public.quiz_questions (lesson_id, question_text, sort_order)
    VALUES (v_lesson_id, 'When communicating with young people, which approach is most effective?', 1)
    RETURNING id INTO v_question_id;
    INSERT INTO public.quiz_options (question_id, option_text, is_correct, sort_order) VALUES
      (v_question_id, 'Using technical language to sound professional', FALSE, 0),
      (v_question_id, 'Speaking quickly to cover more ground', FALSE, 1),
      (v_question_id, 'Using clear, simple language and checking for understanding', TRUE, 2),
      (v_question_id, 'Asking them to email you instead of talking face-to-face', FALSE, 3);

    -- Q3
    INSERT INTO public.quiz_questions (lesson_id, question_text, sort_order)
    VALUES (v_lesson_id, 'Which is the best approach when having a difficult conversation?', 2)
    RETURNING id INTO v_question_id;
    INSERT INTO public.quiz_options (question_id, option_text, is_correct, sort_order) VALUES
      (v_question_id, 'Have it in front of others so there are witnesses', FALSE, 0),
      (v_question_id, 'Send an email to avoid the discomfort of face-to-face discussion', FALSE, 1),
      (v_question_id, 'Use "You always..." statements to be direct', FALSE, 2),
      (v_question_id, 'Choose the right time and place, and use "I" statements', TRUE, 3);
  END IF;
END $$;


-- ===========================================
-- COURSE 4: Working with Schools & Partners (Upskilling)
-- ===========================================
DO $$
DECLARE
  v_course_id UUID;
  v_lesson_id UUID;
  v_question_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.courses WHERE title = 'Working with Schools & Partners') THEN
    INSERT INTO public.courses (title, description, category, duration_minutes, is_required, status, is_active)
    VALUES (
      'Working with Schools & Partners',
      'Build effective partnerships with schools and external organisations to support young people.',
      'upskilling', 50, FALSE, 'published', TRUE
    ) RETURNING id INTO v_course_id;

    -- Lesson 1: Text - Understanding the School Environment
    INSERT INTO public.course_lessons (course_id, title, content, lesson_type, sort_order, is_active)
    VALUES (
      v_course_id,
      'Understanding the School Environment',
      'MCR Pathways operates within schools across Scotland. To be effective in your role, you need to understand the school environment, the challenges schools face, and how to work alongside school staff as a trusted partner.

The School Context:

Schools are busy, complex organisations with many competing priorities. Teachers and school staff are under significant pressure to meet academic targets, support pupil wellbeing, manage behaviour, and comply with local authority requirements — all with limited resources.

Understanding this context helps you:
- Be realistic about what schools can accommodate
- Time your requests appropriately (avoid exam periods, inspections, etc.)
- Show empathy when things do not go to plan
- Build genuine partnerships rather than transactional relationships

Key School Stakeholders:

- Head teacher / Deputy head: Strategic decision-makers. Building a relationship here is crucial for programme success.
- Guidance / Pastoral teachers: Your primary contacts for identifying and supporting young people. They know the pupils best.
- Class teachers: Can provide insights into a young person''s academic progress and classroom behaviour.
- Support staff: Learning assistants, office staff, and janitors often have valuable knowledge about the school community.

How MCR Pathways Fits In:

We are guests in schools. Our programmes complement what schools already do — they do not replace it. This means:
- Respecting school policies and procedures
- Working within the school timetable
- Communicating regularly with school contacts about the young people we support
- Sharing relevant information while respecting confidentiality boundaries
- Celebrating joint successes and acknowledging the school''s contribution',
      'text', 0, TRUE
    );

    -- Lesson 2: Text - Building Effective Partnerships
    INSERT INTO public.course_lessons (course_id, title, content, lesson_type, sort_order, is_active)
    VALUES (
      v_course_id,
      'Building and Maintaining Effective Partnerships',
      'Strong partnerships do not happen by accident. They require deliberate effort, good communication, and mutual respect. This lesson covers practical approaches to building and maintaining effective partnerships with schools and external organisations.

Starting a New Partnership:

1. Do your homework: Before your first meeting, learn about the school''s context, priorities, and any previous experience with MCR Pathways.
2. Listen first: Ask what the school needs rather than leading with what you can offer. Understanding their perspective builds trust.
3. Be clear about expectations: Explain what MCR Pathways can and cannot do. Set realistic expectations from the start.
4. Agree on communication: How often will you meet? Who is the main point of contact? How will information be shared?
5. Start small: Build trust through small, consistent actions before proposing bigger initiatives.

Maintaining Partnerships:

Regular communication is the foundation of strong partnerships. Practical approaches include:
- Scheduling regular check-ins (at least termly) with your key school contact
- Providing brief updates on programme impact and progress
- Responding promptly to emails and phone calls
- Sharing good news stories (with appropriate consent)
- Attending school events when invited
- Being visible and approachable in the school

Working with External Partners:

MCR Pathways also works with local authorities, other charities, and community organisations. The same principles apply:
- Be clear about your role and what you can offer
- Understand the other organisation''s priorities and constraints
- Share information appropriately and follow data sharing agreements
- Attend multi-agency meetings when relevant
- Follow up on agreed actions promptly

When Things Go Wrong:

Despite your best efforts, sometimes partnerships face challenges. Common issues include:
- Miscommunication about expectations or roles
- Changes in school staff (your key contact leaves)
- Competing priorities reducing engagement
- Disagreements about how to support a young person

In these situations: address issues early, be honest about challenges, focus on solutions rather than blame, and escalate to your manager if needed.',
      'text', 1, TRUE
    );

    -- Lesson 3: Quiz
    INSERT INTO public.course_lessons (course_id, title, lesson_type, passing_score, sort_order, is_active)
    VALUES (v_course_id, 'Partnership Working Quiz', 'quiz', 80, 2, TRUE)
    RETURNING id INTO v_lesson_id;

    -- Q1
    INSERT INTO public.quiz_questions (lesson_id, question_text, sort_order)
    VALUES (v_lesson_id, 'What is the best way to start a new school partnership?', 0)
    RETURNING id INTO v_question_id;
    INSERT INTO public.quiz_options (question_id, option_text, is_correct, sort_order) VALUES
      (v_question_id, 'Immediately present all MCR Pathways programmes', FALSE, 0),
      (v_question_id, 'Listen to the school''s needs first and understand their context', TRUE, 1),
      (v_question_id, 'Contact the head teacher only by email', FALSE, 2),
      (v_question_id, 'Wait for the school to approach you', FALSE, 3);

    -- Q2
    INSERT INTO public.quiz_questions (lesson_id, question_text, sort_order)
    VALUES (v_lesson_id, 'How does MCR Pathways fit within the school environment?', 1)
    RETURNING id INTO v_question_id;
    INSERT INTO public.quiz_options (question_id, option_text, is_correct, sort_order) VALUES
      (v_question_id, 'MCR replaces the school''s existing support systems', FALSE, 0),
      (v_question_id, 'MCR operates independently from the school', FALSE, 1),
      (v_question_id, 'MCR complements what schools already do as a trusted partner', TRUE, 2),
      (v_question_id, 'MCR directs schools on how to support young people', FALSE, 3);

    -- Q3
    INSERT INTO public.quiz_questions (lesson_id, question_text, sort_order)
    VALUES (v_lesson_id, 'How often should you have check-ins with your key school contact?', 2)
    RETURNING id INTO v_question_id;
    INSERT INTO public.quiz_options (question_id, option_text, is_correct, sort_order) VALUES
      (v_question_id, 'Only when there is a problem', FALSE, 0),
      (v_question_id, 'Once a year at the annual review', FALSE, 1),
      (v_question_id, 'At least once per term', TRUE, 2),
      (v_question_id, 'Only when the school requests it', FALSE, 3);
  END IF;
END $$;


-- ===========================================
-- COURSE 5: Emotional Intelligence in the Workplace (Soft Skills)
-- ===========================================
DO $$
DECLARE
  v_course_id UUID;
  v_lesson_id UUID;
  v_question_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.courses WHERE title = 'Emotional Intelligence in the Workplace') THEN
    INSERT INTO public.courses (title, description, category, duration_minutes, is_required, status, is_active)
    VALUES (
      'Emotional Intelligence in the Workplace',
      'Understand and develop emotional intelligence for better working relationships and personal effectiveness.',
      'soft_skills', 45, FALSE, 'published', TRUE
    ) RETURNING id INTO v_course_id;

    -- Lesson 1: Text - Understanding Emotional Intelligence
    INSERT INTO public.course_lessons (course_id, title, content, lesson_type, sort_order, is_active)
    VALUES (
      v_course_id,
      'What is Emotional Intelligence?',
      'Emotional intelligence (EI) is the ability to recognise, understand, manage, and effectively use emotions — both your own and those of others. Research shows that emotional intelligence is a stronger predictor of workplace success than IQ.

The Four Components of Emotional Intelligence:

1. Self-awareness: Recognising your own emotions and understanding how they affect your thoughts and behaviour.
- Do you know what triggers your stress or frustration?
- Can you identify your emotions as you experience them?
- Do you understand how your mood affects those around you?

2. Self-management: The ability to control impulsive feelings and behaviours, manage your emotions in healthy ways, and adapt to changing circumstances.
- Can you stay calm under pressure?
- Do you think before reacting?
- Can you motivate yourself even when things are difficult?

3. Social awareness: The ability to understand the emotions, needs, and concerns of others, pick up on emotional cues, and feel comfortable socially.
- Can you sense how others are feeling?
- Do you pay attention to non-verbal communication?
- Are you aware of the dynamics in a group or team?

4. Relationship management: The ability to develop and maintain good relationships, communicate clearly, inspire and influence others, and manage conflict.
- Can you give and receive feedback constructively?
- Do you handle disagreements without damaging relationships?
- Can you collaborate effectively with different personalities?

Why EI Matters at MCR Pathways:

Working with young people, schools, and diverse teams requires a high level of emotional intelligence. Your ability to read situations, manage your reactions, and connect with others directly impacts:
- The quality of your mentoring relationships
- Your effectiveness in building school partnerships
- Your team dynamics and workplace wellbeing
- Your resilience in a demanding role',
      'text', 0, TRUE
    );

    -- Lesson 2: Text - Developing Your EI
    INSERT INTO public.course_lessons (course_id, title, content, lesson_type, sort_order, is_active)
    VALUES (
      v_course_id,
      'Developing Your Emotional Intelligence',
      'The good news is that emotional intelligence can be developed and improved throughout your life. Here are practical strategies for strengthening each component.

Developing Self-Awareness:

- Keep a reflection journal: Spend a few minutes at the end of each day noting your emotional highs and lows. What triggered them? How did you respond?
- Ask for feedback: Trusted colleagues can offer insights into how you come across that you may not see yourself.
- Pause and check in: Throughout the day, pause and ask yourself "How am I feeling right now?" Name the emotion specifically (frustrated, anxious, excited, overwhelmed).
- Identify your patterns: Do you tend to avoid conflict? Get defensive when challenged? Shut down when stressed? Recognising patterns is the first step to changing them.

Developing Self-Management:

- The pause technique: When you feel a strong emotion, pause for a few seconds before responding. This creates space between the trigger and your reaction.
- Reframe the situation: Ask yourself "Is there another way to look at this?" Often our first interpretation is not the most accurate or helpful one.
- Practice stress management: Regular exercise, adequate sleep, and time away from work all help you manage emotions more effectively.
- Set boundaries: Know your limits and communicate them clearly. Saying no when necessary is a sign of emotional maturity.

Developing Social Awareness:

- Practice active listening: Focus entirely on the other person. Notice their tone, body language, and facial expressions as well as their words.
- Be curious about others: Ask people about their experiences and perspectives. Show genuine interest.
- Observe group dynamics: In meetings, notice who speaks up, who stays quiet, and how people interact with each other.
- Develop cultural awareness: Be mindful that emotional expression varies across cultures and backgrounds.

Developing Relationship Management:

- Give feedback with care: Use the SBI model — Situation, Behaviour, Impact — to give specific, constructive feedback.
- Repair relationships: If you make a mistake, apologise sincerely and take steps to make it right. Strong relationships can withstand occasional missteps.
- Be generous with recognition: Acknowledge others'' contributions and celebrate team successes.
- Navigate conflict constructively: Address issues directly but respectfully. Focus on the issue, not the person.',
      'text', 1, TRUE
    );

    -- Lesson 3: Quiz
    INSERT INTO public.course_lessons (course_id, title, lesson_type, passing_score, sort_order, is_active)
    VALUES (v_course_id, 'Emotional Intelligence Quiz', 'quiz', 80, 2, TRUE)
    RETURNING id INTO v_lesson_id;

    -- Q1
    INSERT INTO public.quiz_questions (lesson_id, question_text, sort_order)
    VALUES (v_lesson_id, 'Which of the following is a component of emotional intelligence?', 0)
    RETURNING id INTO v_question_id;
    INSERT INTO public.quiz_options (question_id, option_text, is_correct, sort_order) VALUES
      (v_question_id, 'Technical expertise', FALSE, 0),
      (v_question_id, 'Self-awareness', TRUE, 1),
      (v_question_id, 'Academic qualifications', FALSE, 2),
      (v_question_id, 'Physical fitness', FALSE, 3);

    -- Q2
    INSERT INTO public.quiz_questions (lesson_id, question_text, sort_order)
    VALUES (v_lesson_id, 'What is the "pause technique" used for?', 1)
    RETURNING id INTO v_question_id;
    INSERT INTO public.quiz_options (question_id, option_text, is_correct, sort_order) VALUES
      (v_question_id, 'Taking a lunch break', FALSE, 0),
      (v_question_id, 'Creating space between an emotional trigger and your response', TRUE, 1),
      (v_question_id, 'Pausing a meeting to check your phone', FALSE, 2),
      (v_question_id, 'Waiting for someone else to solve the problem', FALSE, 3);

    -- Q3
    INSERT INTO public.quiz_questions (lesson_id, question_text, sort_order)
    VALUES (v_lesson_id, 'What does the SBI feedback model stand for?', 2)
    RETURNING id INTO v_question_id;
    INSERT INTO public.quiz_options (question_id, option_text, is_correct, sort_order) VALUES
      (v_question_id, 'Strengths, Barriers, Improvements', FALSE, 0),
      (v_question_id, 'Situation, Behaviour, Impact', TRUE, 1),
      (v_question_id, 'Strategy, Budget, Implementation', FALSE, 2),
      (v_question_id, 'Summary, Background, Insight', FALSE, 3);
  END IF;
END $$;


-- ===========================================
-- COURSE 6: Conflict Resolution & Difficult Conversations (Soft Skills)
-- ===========================================
DO $$
DECLARE
  v_course_id UUID;
  v_lesson_id UUID;
  v_question_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.courses WHERE title = 'Conflict Resolution & Difficult Conversations') THEN
    INSERT INTO public.courses (title, description, category, duration_minutes, is_required, status, is_active)
    VALUES (
      'Conflict Resolution & Difficult Conversations',
      'Strategies for handling difficult conversations, managing disagreements, and resolving conflicts constructively.',
      'soft_skills', 50, FALSE, 'published', TRUE
    ) RETURNING id INTO v_course_id;

    -- Lesson 1: Text - Understanding Conflict
    INSERT INTO public.course_lessons (course_id, title, content, lesson_type, sort_order, is_active)
    VALUES (
      v_course_id,
      'Understanding and Approaching Conflict',
      'Conflict is a natural part of working life. It is not always negative — when handled well, conflict can lead to better decisions, stronger relationships, and positive change. The key is how we approach it.

Common Sources of Workplace Conflict:

- Miscommunication or misunderstanding
- Different working styles or priorities
- Unclear roles or responsibilities
- Competing demands for limited resources
- Personality clashes
- Unmet expectations
- Stress and pressure

Your Conflict Style:

People tend to have a default approach to conflict. Understanding your style helps you choose a more effective response:

- Avoiding: Ignoring the issue and hoping it goes away. This can be appropriate for trivial matters but usually makes significant issues worse.
- Accommodating: Giving in to keep the peace. This preserves the relationship but your needs go unmet.
- Competing: Pursuing your own position at the expense of others. Sometimes necessary in urgent situations but damages relationships.
- Compromising: Both parties give up something to reach a middle ground. Quick but may not fully satisfy either side.
- Collaborating: Working together to find a solution that meets everyone''s needs. Takes more time but produces the best outcomes.

In most workplace situations, collaborating or compromising is the most effective approach.

The Cost of Unresolved Conflict:

When conflict is left unaddressed, it tends to escalate. What starts as a minor irritation can grow into a serious issue that affects:
- Team morale and productivity
- Individual wellbeing and job satisfaction
- The quality of service to young people
- Working relationships with schools and partners

The earlier you address a conflict, the easier it is to resolve.',
      'text', 0, TRUE
    );

    -- Lesson 2: Text - Resolution Techniques
    INSERT INTO public.course_lessons (course_id, title, content, lesson_type, sort_order, is_active)
    VALUES (
      v_course_id,
      'Practical Conflict Resolution Techniques',
      'This lesson provides practical tools for resolving conflicts and navigating difficult conversations in the workplace.

Preparing for a Difficult Conversation:

1. Clarify your purpose: What outcome do you want? Be specific.
2. Consider the other person''s perspective: What might they be thinking or feeling? What are their needs?
3. Gather facts: Base the conversation on specific observations, not assumptions or hearsay.
4. Choose the right time and place: Private, neutral, and when neither of you is rushing.
5. Plan your opening: The first 30 seconds set the tone. Start calmly and clearly.

The DESC Framework for Difficult Conversations:

- Describe: State the specific situation or behaviour objectively. "In last week''s meeting, the update I prepared was presented without acknowledgment."
- Express: Share how it affected you, using "I" statements. "I felt frustrated because I had spent significant time on that work."
- Specify: State clearly what you would like to happen. "In future, I''d appreciate being credited when my work is shared."
- Consequences: Explain the positive outcome of the change. "This would help me feel valued and motivated to continue contributing."

Active Listening During Conflict:

When the other person is speaking:
- Listen to understand, not to respond.
- Do not interrupt, even if you disagree.
- Acknowledge their perspective: "I hear what you''re saying" or "I can see why that would be frustrating."
- Ask clarifying questions: "Can you help me understand what you mean by...?"
- Avoid defensive body language (crossed arms, looking away).

Finding Resolution:

- Identify common ground: What do you both agree on? Start there.
- Focus on interests, not positions: Explore why each person wants what they want, not just what they want.
- Generate options together: Brainstorm possible solutions before evaluating them.
- Agree on specific actions: Who will do what, by when?
- Follow up: Check in after the agreed timeframe to see if the resolution is working.

When to Escalate:

Not all conflicts can be resolved between the people involved. Escalate to your manager or HR if:
- The conflict involves harassment, discrimination, or bullying
- You have tried to resolve it directly but it continues
- The conflict is significantly affecting your work or wellbeing
- You feel unsafe or intimidated',
      'text', 1, TRUE
    );

    -- Lesson 3: Quiz
    INSERT INTO public.course_lessons (course_id, title, lesson_type, passing_score, sort_order, is_active)
    VALUES (v_course_id, 'Conflict Resolution Quiz', 'quiz', 80, 2, TRUE)
    RETURNING id INTO v_lesson_id;

    -- Q1
    INSERT INTO public.quiz_questions (lesson_id, question_text, sort_order)
    VALUES (v_lesson_id, 'Which conflict resolution style typically produces the best long-term outcomes?', 0)
    RETURNING id INTO v_question_id;
    INSERT INTO public.quiz_options (question_id, option_text, is_correct, sort_order) VALUES
      (v_question_id, 'Avoiding', FALSE, 0),
      (v_question_id, 'Competing', FALSE, 1),
      (v_question_id, 'Collaborating', TRUE, 2),
      (v_question_id, 'Accommodating', FALSE, 3);

    -- Q2
    INSERT INTO public.quiz_questions (lesson_id, question_text, sort_order)
    VALUES (v_lesson_id, 'What does the "E" in the DESC framework stand for?', 1)
    RETURNING id INTO v_question_id;
    INSERT INTO public.quiz_options (question_id, option_text, is_correct, sort_order) VALUES
      (v_question_id, 'Evaluate', FALSE, 0),
      (v_question_id, 'Express', TRUE, 1),
      (v_question_id, 'Escalate', FALSE, 2),
      (v_question_id, 'Execute', FALSE, 3);

    -- Q3
    INSERT INTO public.quiz_questions (lesson_id, question_text, sort_order)
    VALUES (v_lesson_id, 'What should you focus on when trying to resolve a conflict?', 2)
    RETURNING id INTO v_question_id;
    INSERT INTO public.quiz_options (question_id, option_text, is_correct, sort_order) VALUES
      (v_question_id, 'Proving you are right', FALSE, 0),
      (v_question_id, 'Winning the argument', FALSE, 1),
      (v_question_id, 'Interests and underlying needs of both parties', TRUE, 2),
      (v_question_id, 'Getting the conversation over with quickly', FALSE, 3);

    -- Q4
    INSERT INTO public.quiz_questions (lesson_id, question_text, sort_order)
    VALUES (v_lesson_id, 'When should you escalate a conflict to your manager or HR?', 3)
    RETURNING id INTO v_question_id;
    INSERT INTO public.quiz_options (question_id, option_text, is_correct, sort_order) VALUES
      (v_question_id, 'As soon as any disagreement arises', FALSE, 0),
      (v_question_id, 'Only if someone gets physically aggressive', FALSE, 1),
      (v_question_id, 'When it involves harassment, bullying, or cannot be resolved directly', TRUE, 2),
      (v_question_id, 'Never — all conflicts should be resolved between the people involved', FALSE, 3);
  END IF;
END $$;


-- ===========================================
-- COURSE 7: Time Management & Productivity (Soft Skills)
-- ===========================================
DO $$
DECLARE
  v_course_id UUID;
  v_lesson_id UUID;
  v_question_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.courses WHERE title = 'Time Management & Productivity') THEN
    INSERT INTO public.courses (title, description, category, duration_minutes, is_required, status, is_active)
    VALUES (
      'Time Management & Productivity',
      'Tools and techniques for managing your workload effectively, prioritising tasks, and maintaining productivity.',
      'soft_skills', 40, FALSE, 'published', TRUE
    ) RETURNING id INTO v_course_id;

    -- Lesson 1: Text - Time Management Fundamentals
    INSERT INTO public.course_lessons (course_id, title, content, lesson_type, sort_order, is_active)
    VALUES (
      v_course_id,
      'Time Management Fundamentals',
      'Effective time management is not about doing more — it is about doing the right things at the right time. In busy roles at MCR Pathways, where you juggle school visits, mentoring sessions, administration, and team meetings, managing your time well is essential.

The Eisenhower Matrix:

One of the most effective tools for prioritisation is the Eisenhower Matrix, which categorises tasks into four quadrants:

Quadrant 1 — Urgent and Important: Do these first. Examples: a safeguarding concern, a deadline today, a crisis that needs immediate attention.

Quadrant 2 — Important but Not Urgent: Schedule time for these. Examples: planning sessions, building school relationships, professional development. This quadrant is where the most valuable work happens.

Quadrant 3 — Urgent but Not Important: Delegate or minimise. Examples: some emails, phone calls that could be handled by someone else, interruptions.

Quadrant 4 — Neither Urgent nor Important: Eliminate or reduce. Examples: excessive social media, unnecessary meetings, tasks that add little value.

Most people spend too much time in Quadrant 3 (reacting to urgent-seeming but unimportant tasks) and too little in Quadrant 2 (proactive, strategic work).

Planning Your Week:

- At the start of each week, identify your top 3-5 priorities.
- Block time in your calendar for important tasks (Quadrant 2 work).
- Build in buffer time for unexpected issues — they will arise.
- Group similar tasks together (e.g., make all phone calls in one block).
- Review your week on Friday: what went well, what needs to carry forward?

Managing Your Energy:

Time management is also about energy management. Identify when you are most focused and alert during the day, and schedule your most demanding tasks for those times. Save routine admin for when your energy is lower.',
      'text', 0, TRUE
    );

    -- Lesson 2: Text - Practical Productivity Techniques
    INSERT INTO public.course_lessons (course_id, title, content, lesson_type, sort_order, is_active)
    VALUES (
      v_course_id,
      'Practical Productivity Techniques',
      'This lesson covers practical techniques for staying productive, managing distractions, and maintaining focus throughout your working day.

The Pomodoro Technique:

Work in focused 25-minute intervals (pomodoros) followed by 5-minute breaks. After four pomodoros, take a longer 15-30 minute break. This technique helps because:
- It breaks large tasks into manageable chunks
- The timer creates a sense of urgency
- Regular breaks prevent mental fatigue
- It makes it easier to track how you spend your time

Managing Email Effectively:

Email can be one of the biggest productivity drains. Try these strategies:
- Check email at set times (e.g., 9am, 12pm, 4pm) rather than constantly
- Use the two-minute rule: if an email takes less than two minutes to handle, do it immediately
- Sort emails into folders: Action Required, Waiting For, Reference
- Unsubscribe from newsletters and notifications you do not read
- Write clear subject lines so recipients can prioritise your emails

Dealing with Distractions:

- Identify your biggest distractions and create strategies to manage them
- Turn off non-essential notifications on your phone and computer
- If you need to focus, let colleagues know and set your status to "do not disturb"
- If you are interrupted, make a quick note of where you were so you can return easily
- Keep your workspace tidy — physical clutter creates mental clutter

Saying No:

One of the most important productivity skills is saying no. You cannot do everything, and taking on too much leads to stress and poor-quality work.

How to say no professionally:
- "I would love to help, but I am committed to [priority] this week. Could we revisit next week?"
- "I do not think I am the best person for this — would [colleague] be able to help?"
- "I can do this, but it would mean delaying [other task]. Which would you prefer I prioritise?"

Avoiding Procrastination:

- Break large tasks into small, specific steps
- Start with the easiest part to build momentum
- Set a timer and commit to working for just 10 minutes — often you will continue beyond that
- Remove temptations from your workspace
- Reward yourself for completing challenging tasks',
      'text', 1, TRUE
    );

    -- Lesson 3: Quiz
    INSERT INTO public.course_lessons (course_id, title, lesson_type, passing_score, sort_order, is_active)
    VALUES (v_course_id, 'Time Management Quiz', 'quiz', 80, 2, TRUE)
    RETURNING id INTO v_lesson_id;

    -- Q1
    INSERT INTO public.quiz_questions (lesson_id, question_text, sort_order)
    VALUES (v_lesson_id, 'In the Eisenhower Matrix, which quadrant should you spend the most time in?', 0)
    RETURNING id INTO v_question_id;
    INSERT INTO public.quiz_options (question_id, option_text, is_correct, sort_order) VALUES
      (v_question_id, 'Urgent and Important', FALSE, 0),
      (v_question_id, 'Important but Not Urgent', TRUE, 1),
      (v_question_id, 'Urgent but Not Important', FALSE, 2),
      (v_question_id, 'Neither Urgent nor Important', FALSE, 3);

    -- Q2
    INSERT INTO public.quiz_questions (lesson_id, question_text, sort_order)
    VALUES (v_lesson_id, 'How long is a standard Pomodoro work interval?', 1)
    RETURNING id INTO v_question_id;
    INSERT INTO public.quiz_options (question_id, option_text, is_correct, sort_order) VALUES
      (v_question_id, '10 minutes', FALSE, 0),
      (v_question_id, '25 minutes', TRUE, 1),
      (v_question_id, '45 minutes', FALSE, 2),
      (v_question_id, '60 minutes', FALSE, 3);

    -- Q3
    INSERT INTO public.quiz_questions (lesson_id, question_text, sort_order)
    VALUES (v_lesson_id, 'What is the "two-minute rule" for email?', 2)
    RETURNING id INTO v_question_id;
    INSERT INTO public.quiz_options (question_id, option_text, is_correct, sort_order) VALUES
      (v_question_id, 'Only spend two minutes reading each email', FALSE, 0),
      (v_question_id, 'Check email every two minutes', FALSE, 1),
      (v_question_id, 'If it takes less than two minutes to handle, do it immediately', TRUE, 2),
      (v_question_id, 'Wait two minutes before replying to any email', FALSE, 3);
  END IF;
END $$;
