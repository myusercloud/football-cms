import type { Schema, Struct } from '@strapi/strapi';

export interface FootballGoalEvent extends Struct.ComponentSchema {
  collectionName: 'components_football_goal_events';
  info: {
    displayName: 'Goal Event';
    icon: 'football';
  };
  attributes: {
    addedTime: Schema.Attribute.Integer;
    club: Schema.Attribute.Relation<'manyToOne', 'api::club.club'>;
    isOwnGoal: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    isPenalty: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    minute: Schema.Attribute.Integer & Schema.Attribute.Required;
    player: Schema.Attribute.Relation<'manyToOne', 'api::player.player'>;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'football.goal-event': FootballGoalEvent;
    }
  }
}
