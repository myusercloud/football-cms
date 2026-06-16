"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const RichBodyInput_1 = require("./admin/RichBodyInput");
exports.default = {
    register(app) {
        app.customFields.register({
            name: 'rich-body',
            pluginId: 'rich-body',
            type: 'richtext',
            intlLabel: {
                id: 'rich-body.label',
                defaultMessage: 'Rich Body',
            },
            intlDescription: {
                id: 'rich-body.description',
                defaultMessage: 'Rich text with @mention support for players and clubs',
            },
            components: {
                Input: async () => ({ default: RichBodyInput_1.RichBodyInput }),
            },
        });
    },
};
