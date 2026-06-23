export default {
  collectionName: 'components_football_goal_events',
  info: { displayName: 'Goal Event', icon: 'football' },
  options: {},
  attributes: {
    player: {
      type: 'relation',
      relation: 'manyToOne',
      target: 'api::player.player',
    },
    club: {
      type: 'relation',
      relation: 'manyToOne',
      target: 'api::club.club',
    },
    minute: { type: 'integer', required: true },
    addedTime: { type: 'integer' },
    isOwnGoal: { type: 'boolean', default: false },
    isPenalty: { type: 'boolean', default: false },
  },
}
