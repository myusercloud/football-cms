export default {
  kind: 'collectionType',
  collectionName: 'goal_events',
  info: {
    singularName: 'goal-event',
    pluralName: 'goal-events',
    displayName: 'Goal Event',
  },
  options: { draftAndPublish: false },
  pluginOptions: {},
  attributes: {
    fixture: {
      type: 'relation',
      relation: 'manyToOne',
      target: 'api::fixture.fixture',
      inversedBy: 'goalEvents',
      required: true,
    },
    player: {
      type: 'relation',
      relation: 'manyToOne',
      target: 'api::player.player',
      required: true,
    },
    team: {
      type: 'enumeration',
      enum: ['home', 'away'],
      required: true,
    },
    minute: { type: 'integer', required: true },
    addedTime: { type: 'integer' },
    isOwnGoal: { type: 'boolean', default: false },
    isPenalty: { type: 'boolean', default: false },
  },
}
