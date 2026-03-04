/**
 * Seed MCR Pathways org structure into Supabase.
 * Auth users were already created via admin API, profiles exist but need
 * job_title, department, region, line_manager_id, etc. updates.
 *
 * Usage: SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/seed-org-structure.mjs
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://eapnkclguiogyatmntze.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Define the full org structure: email → profile data
// line_manager_email is resolved to line_manager_id at runtime
const orgData = [
  // Executive
  { email: "eleanor.macgregor@mcrpathways.org", job_title: "Chief Executive", department: "executive", region: "west", mgr: null, lm: true, hr: true, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },

  // Directors
  { email: "fiona.henderson@mcrpathways.org", job_title: "People Director", department: "people", region: "west", mgr: "eleanor.macgregor@mcrpathways.org", lm: true, hr: true, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "graham.nicholson@mcrpathways.org", job_title: "Finance Director", department: "finance", region: "west", mgr: "eleanor.macgregor@mcrpathways.org", lm: true, hr: false, ld: false, sys: false, fte: 0.6, ext: false, ut: "staff" },
  { email: "rachel.donaldson@mcrpathways.org", job_title: "Delivery Director", department: "delivery", region: "west", mgr: "eleanor.macgregor@mcrpathways.org", lm: true, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "margaret.campbell@mcrpathways.org", job_title: "Development Director", department: "development", region: "west", mgr: "eleanor.macgregor@mcrpathways.org", lm: true, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },

  // HR
  { email: "sarah.mitchell@mcrpathways.org", job_title: "HR Advisor", department: "hr", region: "west", mgr: "fiona.henderson@mcrpathways.org", lm: false, hr: true, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "isla.robertson@mcrpathways.org", job_title: "Executive Support Coordinator", department: "hr", region: "west", mgr: "fiona.henderson@mcrpathways.org", lm: false, hr: false, ld: false, sys: false, fte: 0.6, ext: false, ut: "staff" },

  // L&D
  { email: "david.murray@mcrpathways.org", job_title: "Learning & Development Manager", department: "learning_development", region: "west", mgr: "fiona.henderson@mcrpathways.org", lm: true, hr: false, ld: true, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "heather.wallace@mcrpathways.org", job_title: "Regional Quality & Learning Lead", department: "learning_development", region: "west", mgr: "david.murray@mcrpathways.org", lm: false, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "claire.thomson@mcrpathways.org", job_title: "Regional Quality & Learning Lead", department: "learning_development", region: "east", mgr: "david.murray@mcrpathways.org", lm: false, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },

  // Finance
  { email: "laura.paterson@mcrpathways.org", job_title: "Finance Manager", department: "finance", region: "west", mgr: "graham.nicholson@mcrpathways.org", lm: false, hr: false, ld: false, sys: false, fte: 0.8, ext: false, ut: "staff" },

  // Systems
  { email: "andrew.ferguson@mcrpathways.org", job_title: "Head of Systems, Evidence & Impact", department: "systems", region: "west", mgr: "rachel.donaldson@mcrpathways.org", lm: true, hr: false, ld: false, sys: true, fte: 1.0, ext: false, ut: "staff" },
  { email: "ryan.macleod@mcrpathways.org", job_title: "Systems and Infrastructure Officer", department: "systems", region: "west", mgr: "andrew.ferguson@mcrpathways.org", lm: false, hr: false, ld: false, sys: true, fte: 1.0, ext: false, ut: "staff" },
  { email: "karen.stewart@mcrpathways.org", job_title: "Evidence & Impact Officer", department: "systems", region: "west", mgr: "andrew.ferguson@mcrpathways.org", lm: false, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "omar.hassan@mcrpathways.org", job_title: "Systems Coordinator", department: "systems", region: "west", mgr: "andrew.ferguson@mcrpathways.org", lm: false, hr: false, ld: false, sys: true, fte: 1.0, ext: false, ut: "staff" },

  // Engagement
  { email: "priya.sharma@mcrpathways.org", job_title: "Head of Engagement and Influencing", department: "engagement", region: "west", mgr: "margaret.campbell@mcrpathways.org", lm: true, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "callum.reid@mcrpathways.org", job_title: "Mentor and Young People Engagement Officer", department: "engagement", region: "west", mgr: "priya.sharma@mcrpathways.org", lm: false, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "hannah.douglas@mcrpathways.org", job_title: "Mentor and Young People Engagement Officer", department: "engagement", region: "west", mgr: "priya.sharma@mcrpathways.org", lm: false, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },

  // Communications
  { email: "neil.crawford@mcrpathways.org", job_title: "Strategic Communications Lead", department: "communications", region: "west", mgr: "priya.sharma@mcrpathways.org", lm: true, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "megan.scott@mcrpathways.org", job_title: "Senior Marketing Officer", department: "communications", region: "west", mgr: "neil.crawford@mcrpathways.org", lm: false, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "aisha.begum@mcrpathways.org", job_title: "Policy & Public Affairs Officer", department: "communications", region: "west", mgr: "neil.crawford@mcrpathways.org", lm: false, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "lucy.brennan@mcrpathways.org", job_title: "Policy & Public Affairs Officer", department: "communications", region: "west", mgr: "neil.crawford@mcrpathways.org", lm: false, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },

  // Fundraising
  { email: "victoria.grant@mcrpathways.org", job_title: "Head of Fundraising", department: "fundraising", region: "west", mgr: "margaret.campbell@mcrpathways.org", lm: true, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "jennifer.kerr@mcrpathways.org", job_title: "Senior Fundraising Officer", department: "fundraising", region: "west", mgr: "victoria.grant@mcrpathways.org", lm: false, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "robyn.anderson@mcrpathways.org", job_title: "Fundraising Officer", department: "fundraising", region: "west", mgr: "victoria.grant@mcrpathways.org", lm: false, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "aileen.fraser@mcrpathways.org", job_title: "Strategic Partnerships Lead", department: "fundraising", region: "east", mgr: "victoria.grant@mcrpathways.org", lm: false, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },

  // WEST REGION
  { email: "james.crawford@mcrpathways.org", job_title: "Head of Schools (West)", department: "delivery", region: "west", mgr: "rachel.donaldson@mcrpathways.org", lm: true, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "gemma.taylor@mcrpathways.org", job_title: "Programme Manager", department: "delivery", region: "west", mgr: "james.crawford@mcrpathways.org", lm: true, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "scott.wilson@mcrpathways.org", job_title: "Programme Manager", department: "delivery", region: "west", mgr: "james.crawford@mcrpathways.org", lm: true, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "amy.macdonald@mcrpathways.org", job_title: "Programme Manager", department: "delivery", region: "west", mgr: "james.crawford@mcrpathways.org", lm: true, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "emma.clark@mcrpathways.org", job_title: "Programme Manager", department: "delivery", region: "west", mgr: "james.crawford@mcrpathways.org", lm: true, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "kirsty.hamilton@mcrpathways.org", job_title: "Senior Partnerships Manager", department: "delivery", region: "west", mgr: "james.crawford@mcrpathways.org", lm: true, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "nicola.johnstone@mcrpathways.org", job_title: "Senior Partnerships Manager", department: "delivery", region: "west", mgr: "james.crawford@mcrpathways.org", lm: true, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "diane.morrison@mcrpathways.org", job_title: "Programme Manager", department: "delivery", region: "west", mgr: "james.crawford@mcrpathways.org", lm: true, hr: false, ld: false, sys: false, fte: 1.0, ext: true, ut: "staff" },
  { email: "brian.kelly@mcrpathways.org", job_title: "Programme Manager", department: "delivery", region: "west", mgr: "james.crawford@mcrpathways.org", lm: true, hr: false, ld: false, sys: false, fte: 1.0, ext: true, ut: "staff" },
  { email: "zara.ahmed@mcrpathways.org", job_title: "MS Coordinator", department: "delivery", region: "west", mgr: "gemma.taylor@mcrpathways.org", lm: false, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "craig.menzies@mcrpathways.org", job_title: "MS Coordinator", department: "delivery", region: "west", mgr: "scott.wilson@mcrpathways.org", lm: false, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "rebecca.fleming@mcrpathways.org", job_title: "MS Coordinator", department: "delivery", region: "west", mgr: "amy.macdonald@mcrpathways.org", lm: false, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "louise.baxter@mcrpathways.org", job_title: "Regional Coordinator", department: "delivery", region: "west", mgr: "emma.clark@mcrpathways.org", lm: false, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "mark.davidson@mcrpathways.org", job_title: "Pathways Outreach Coordinator", department: "delivery", region: "west", mgr: "amy.macdonald@mcrpathways.org", lm: false, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "pathways_coordinator" },
  { email: "julie.connolly@mcrpathways.org", job_title: "MS Coordinator", department: "delivery", region: "west", mgr: "kirsty.hamilton@mcrpathways.org", lm: false, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "thomas.rankin@mcrpathways.org", job_title: "MS Coordinator", department: "delivery", region: "west", mgr: "nicola.johnstone@mcrpathways.org", lm: false, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "patricia.renfrew@mcrpathways.org", job_title: "MS Coordinator", department: "delivery", region: "west", mgr: "diane.morrison@mcrpathways.org", lm: false, hr: false, ld: false, sys: false, fte: 0.4, ext: true, ut: "staff" },

  // EAST REGION
  { email: "wendy.sutherland@mcrpathways.org", job_title: "Head of Schools (East)", department: "delivery", region: "east", mgr: "margaret.campbell@mcrpathways.org", lm: true, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "ruth.mackenzie@mcrpathways.org", job_title: "Programme Manager", department: "delivery", region: "east", mgr: "wendy.sutherland@mcrpathways.org", lm: true, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "susan.boyd@mcrpathways.org", job_title: "Programme Manager", department: "delivery", region: "east", mgr: "wendy.sutherland@mcrpathways.org", lm: true, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "liam.obrien@mcrpathways.org", job_title: "Programme Manager", department: "delivery", region: "east", mgr: "wendy.sutherland@mcrpathways.org", lm: true, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "ewan.douglas@mcrpathways.org", job_title: "Programme Manager", department: "delivery", region: "east", mgr: "wendy.sutherland@mcrpathways.org", lm: true, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "chloe.picken@mcrpathways.org", job_title: "Programme Manager", department: "delivery", region: "east", mgr: "wendy.sutherland@mcrpathways.org", lm: true, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "mary.buglass@mcrpathways.org", job_title: "Senior Partnerships Manager", department: "delivery", region: "east", mgr: "wendy.sutherland@mcrpathways.org", lm: true, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "daniel.morris@mcrpathways.org", job_title: "Partnerships Manager", department: "delivery", region: "east", mgr: "mary.buglass@mcrpathways.org", lm: true, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "helen.goodey@mcrpathways.org", job_title: "Partnerships & Volunteer Recruitment Coordinator", department: "delivery", region: "east", mgr: "daniel.morris@mcrpathways.org", lm: false, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "alison.whitelaw@mcrpathways.org", job_title: "MS Coordinator", department: "delivery", region: "east", mgr: "ruth.mackenzie@mcrpathways.org", lm: false, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "jenna.dempsey@mcrpathways.org", job_title: "MS Coordinator", department: "delivery", region: "east", mgr: "susan.boyd@mcrpathways.org", lm: false, hr: false, ld: false, sys: false, fte: 0.8, ext: false, ut: "staff" },
  { email: "nathan.kelly@mcrpathways.org", job_title: "MS Coordinator", department: "delivery", region: "east", mgr: "liam.obrien@mcrpathways.org", lm: false, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "andrea.ellis@mcrpathways.org", job_title: "MS Coordinator", department: "delivery", region: "east", mgr: "ewan.douglas@mcrpathways.org", lm: false, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "gordon.hutton@mcrpathways.org", job_title: "Pathways Coordinator", department: "delivery", region: "east", mgr: "ewan.douglas@mcrpathways.org", lm: false, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "pathways_coordinator" },
  { email: "priti.desilva@mcrpathways.org", job_title: "Pathways Coordinator", department: "delivery", region: "east", mgr: "ewan.douglas@mcrpathways.org", lm: false, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "pathways_coordinator" },
  { email: "keith.dougall@mcrpathways.org", job_title: "Pathways Coordinator", department: "delivery", region: "east", mgr: "ewan.douglas@mcrpathways.org", lm: false, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "pathways_coordinator" },
  { email: "tanya.reid@mcrpathways.org", job_title: "Pathways Coordinator", department: "delivery", region: "east", mgr: "chloe.picken@mcrpathways.org", lm: false, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "pathways_coordinator" },

  // NORTH REGION
  { email: "duncan.jardine@mcrpathways.org", job_title: "Head of Schools (North)", department: "delivery", region: "north", mgr: "rachel.donaldson@mcrpathways.org", lm: true, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "hazel.lucas@mcrpathways.org", job_title: "Programme Manager", department: "delivery", region: "north", mgr: "duncan.jardine@mcrpathways.org", lm: true, hr: false, ld: false, sys: false, fte: 0.8, ext: false, ut: "staff" },
  { email: "eilidh.fraser@mcrpathways.org", job_title: "Partnerships Manager", department: "delivery", region: "north", mgr: "duncan.jardine@mcrpathways.org", lm: false, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "morag.finnie@mcrpathways.org", job_title: "Community Delivery Lead", department: "delivery", region: "north", mgr: "duncan.jardine@mcrpathways.org", lm: true, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "sophie.turnbull@mcrpathways.org", job_title: "Aberdeen Young Carers PC", department: "delivery", region: "north", mgr: "morag.finnie@mcrpathways.org", lm: false, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "pathways_coordinator" },
  { email: "mairi.brennan@mcrpathways.org", job_title: "MS Coordinator", department: "delivery", region: "north", mgr: "hazel.lucas@mcrpathways.org", lm: false, hr: false, ld: false, sys: false, fte: 0.6, ext: false, ut: "staff" },
  { email: "faye.mcneill@mcrpathways.org", job_title: "Pathways Coordinator", department: "delivery", region: "north", mgr: "hazel.lucas@mcrpathways.org", lm: false, hr: false, ld: false, sys: false, fte: 0.8, ext: false, ut: "pathways_coordinator" },
  { email: "diane.sinclair@mcrpathways.org", job_title: "Pathways Coordinator", department: "delivery", region: "north", mgr: "hazel.lucas@mcrpathways.org", lm: false, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "pathways_coordinator" },
  { email: "beth.skinner@mcrpathways.org", job_title: "Pathways Coordinator", department: "delivery", region: "north", mgr: "hazel.lucas@mcrpathways.org", lm: false, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "pathways_coordinator" },
  { email: "ross.taylor@mcrpathways.org", job_title: "Pathways Coordinator", department: "delivery", region: "north", mgr: "hazel.lucas@mcrpathways.org", lm: false, hr: false, ld: false, sys: false, fte: 0.75, ext: false, ut: "pathways_coordinator" },
  { email: "fatima.cunningham@mcrpathways.org", job_title: "Pathways Coordinator", department: "delivery", region: "north", mgr: "hazel.lucas@mcrpathways.org", lm: false, hr: false, ld: false, sys: false, fte: 0.56, ext: false, ut: "pathways_coordinator" },
  { email: "ian.fraser@mcrpathways.org", job_title: "Pathways Coordinator", department: "delivery", region: "north", mgr: "hazel.lucas@mcrpathways.org", lm: false, hr: false, ld: false, sys: false, fte: 0.75, ext: false, ut: "pathways_coordinator" },
  { email: "cameron.ross@mcrpathways.org", job_title: "Pathways Coordinator", department: "delivery", region: "north", mgr: "hazel.lucas@mcrpathways.org", lm: false, hr: false, ld: false, sys: false, fte: 0.75, ext: false, ut: "pathways_coordinator" },
  { email: "kevin.fowler@mcrpathways.org", job_title: "Pathways Coordinator", department: "delivery", region: "north", mgr: "hazel.lucas@mcrpathways.org", lm: false, hr: false, ld: false, sys: false, fte: 0.8, ext: false, ut: "pathways_coordinator" },

  // ENGLAND REGION
  { email: "angela.fellowes@mcrpathways.org", job_title: "Head of Schools (England)", department: "delivery", region: "england", mgr: "margaret.campbell@mcrpathways.org", lm: true, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "charlotte.parkes@mcrpathways.org", job_title: "Regional Ops and Events Manager", department: "delivery", region: "england", mgr: "angela.fellowes@mcrpathways.org", lm: true, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "ben.pentland@mcrpathways.org", job_title: "Programme Manager", department: "delivery", region: "england", mgr: "angela.fellowes@mcrpathways.org", lm: true, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "anya.masood@mcrpathways.org", job_title: "Programme Manager", department: "delivery", region: "england", mgr: "angela.fellowes@mcrpathways.org", lm: false, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "raj.hundal@mcrpathways.org", job_title: "Programme Manager", department: "delivery", region: "england", mgr: "angela.fellowes@mcrpathways.org", lm: false, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "peter.moses@mcrpathways.org", job_title: "Partnerships Manager", department: "development", region: "england", mgr: "angela.fellowes@mcrpathways.org", lm: false, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "samantha.grace@mcrpathways.org", job_title: "Partnerships Manager", department: "development", region: "england", mgr: "angela.fellowes@mcrpathways.org", lm: false, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "nadia.chalret@mcrpathways.org", job_title: "Partnerships Manager", department: "development", region: "england", mgr: "angela.fellowes@mcrpathways.org", lm: false, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "yasmin.aljeffri@mcrpathways.org", job_title: "Partnerships Manager", department: "development", region: "england", mgr: "angela.fellowes@mcrpathways.org", lm: false, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "natasha.middleton@mcrpathways.org", job_title: "MS Coordinator", department: "delivery", region: "england", mgr: "charlotte.parkes@mcrpathways.org", lm: false, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "amy.wenderling@mcrpathways.org", job_title: "MS Coordinator", department: "delivery", region: "england", mgr: "charlotte.parkes@mcrpathways.org", lm: false, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
  { email: "tamanna.uddin@mcrpathways.org", job_title: "MS Coordinator", department: "delivery", region: "england", mgr: "charlotte.parkes@mcrpathways.org", lm: false, hr: false, ld: false, sys: false, fte: 1.0, ext: false, ut: "staff" },
];

async function run() {
  // 1. Fetch all profiles, build email→id map
  const { data: allProfiles, error: fetchErr } = await supabase
    .from("profiles")
    .select("id, email")
    .like("email", "%@mcrpathways.org");

  if (fetchErr) {
    console.error("Failed to fetch profiles:", fetchErr.message);
    process.exit(1);
  }

  const emailToId = {};
  for (const p of allProfiles) {
    emailToId[p.email] = p.id;
  }
  console.log(`Found ${Object.keys(emailToId).length} @mcrpathways.org profiles`);

  // 2. Update each profile
  let updated = 0;
  let errors = 0;

  for (const u of orgData) {
    const profileId = emailToId[u.email];
    if (!profileId) {
      console.error(`No profile for ${u.email}`);
      errors++;
      continue;
    }

    const managerId = u.mgr ? emailToId[u.mgr] : null;
    if (u.mgr && !managerId) {
      console.error(`No manager profile for ${u.mgr} (needed by ${u.email})`);
      errors++;
      continue;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        job_title: u.job_title,
        department: u.department,
        region: u.region,
        line_manager_id: managerId,
        is_line_manager: u.lm,
        is_hr_admin: u.hr,
        is_ld_admin: u.ld,
        is_systems_admin: u.sys,
        fte: u.fte,
        is_external: u.ext,
        user_type: u.ut,
        status: "active",
      })
      .eq("id", profileId);

    if (error) {
      console.error(`Update error for ${u.email}: ${error.message}`);
      errors++;
    } else {
      updated++;
    }
  }

  console.log(`\nDone! Updated: ${updated}, Errors: ${errors}`);

  // 3. Verify
  const { count } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true });
  console.log(`Total profiles in DB: ${count}`);

  const { data: ceo } = await supabase
    .from("profiles")
    .select("full_name, job_title, department, region")
    .eq("email", "eleanor.macgregor@mcrpathways.org")
    .single();
  console.log("CEO:", JSON.stringify(ceo));

  const { data: sample } = await supabase
    .from("profiles")
    .select("full_name, job_title, department")
    .not("job_title", "is", null)
    .limit(5);
  console.log("Sample updated profiles:", JSON.stringify(sample, null, 2));
}

run();
