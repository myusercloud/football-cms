"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    kind: 'collectionType',
    collectionName: 'transfers',
    info: {
        singularName: 'transfer',
        pluralName: 'transfers',
        displayName: 'Transfer',
        description: 'Player transfer records and rumours',
    },
    options: { draftAndPublish: false },
    pluginOptions: {},
    attributes: {
        playerName: { type: 'string', required: true },
        playerPosition: { type: 'string', required: true },
        playerNationality: { type: 'string', required: true },
        playerAge: { type: 'integer' },
        fromClubName: { type: 'string' },
        fromClubShortName: { type: 'string' },
        fromClubSlug: { type: 'string' },
        fromClubCountry: { type: 'string' },
        toClubName: { type: 'string' },
        toClubShortName: { type: 'string' },
        toClubSlug: { type: 'string' },
        toClubCountry: { type: 'string' },
        fee: { type: 'string' },
        status: {
            type: 'enumeration',
            enum: ['confirmed', 'loan', 'rumour', 'exit'],
            required: true,
        },
        confidence: {
            type: 'enumeration',
            enum: ['hot', 'warm', 'cool'],
        },
        window: { type: 'string', required: true },
        transferDate: { type: 'date', required: true },
        sourceLabel: { type: 'string' },
        linkedArticleSlug: { type: 'string' },
    },
};
