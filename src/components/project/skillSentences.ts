/**
 * Why KAE asked what it asked, in a sentence a person can read.
 *
 * One line per interviewing skill in cris-cie-slim. The two are checked against
 * each other by `backend/tests/test_skill_sentences_are_complete.py`, which is
 * the only place both worlds are importable — four skills added in one day once
 * rendered as "it is working through adopt working assumption" because nothing
 * connected them.
 *
 * Its own module because the table is data, not a component. A file exporting
 * both cannot be hot-reloaded.
 *
 * **`WhyThisQuestion` still falls back to naming the raw skill**, and that stays.
 * CIE chooses its skills freely, so this table will fall behind again; naming
 * the skill is worse prose and better information than showing no reason at all.
 */

export const SKILL_SENTENCES: Record<string, string> = {
  clarify: 'that answer could mean more than one thing',
  deepen: 'the answer is right but too thin to build from',
  separate_need_from_solution: 'a mechanism was described before the need behind it',
  identify_people: 'who this affects is still undefined',
  test_assumption: 'something is being treated as settled that has not been established',
  surface_exceptions: 'the happy path is clear and the exceptions are not',
  explore_constraints: 'the limits that bound this are not recorded',
  reconcile_contradiction: 'this conflicts with something already recorded',
  derive_acceptance: 'nothing yet says how you would know this was met',
  reflect_for_confirmation: 'enough has accumulated to be worth confirming',
  challenge_premature_design: 'the conversation moved to design before the problem was settled',
  handle_non_answer: 'the last reply did not answer the question',
  follow_thread: 'you raised something more important than the current subject',
  acknowledge_sufficiency: 'this subject is established well enough',
  recommend: 'you asked what I would do, or the choice needed a view',
  adopt_working_assumption: 'you left the choice to me, so I took a position',
  answer_and_resume: 'you raised something worth answering before carrying on',
  offer_to_defer: 'this is worth asking and not worth answering yet',
}
