export default {
  kind: 'collectionType',
  collectionName: 'fixtures',
  info: {
    singularName: 'fixture',
    pluralName: 'fixtures',
    displayName: 'Fixture',
  },
  options: { draftAndPublish: false },
  pluginOptions: {},
  attributes: {
    matchStatus: {
      type: 'enumeration',
      enum: ['scheduled', 'live', 'halftime', 'fulltime', 'postponed'],
      default: 'scheduled',
      required: true,
    },
    kickoff: { type: 'datetime', required: true },
    matchday: { type: 'integer' },
    season: { type: 'string' },
    featured: { type: 'boolean', default: false },
    homeTeam: {
      type: 'relation',
      relation: 'manyToOne',
      target: 'api::club.club',
    },
    awayTeam: {
      type: 'relation',
      relation: 'manyToOne',
      target: 'api::club.club',
    },
    competition: {
      type: 'relation',
      relation: 'manyToOne',
      target: 'api::tournament.tournament',
    },
    venueName: { type: 'string' },
    venueCity: { type: 'string' },
    scoreHome: { type: 'integer' },
    scoreAway: { type: 'integer' },
    liveMinute: { type: 'integer' },
    preview: { type: 'text' },
    goalEvents: {
      type: 'component',
      component: 'football.goal-event',
      repeatable: true,
    },
  },
}
