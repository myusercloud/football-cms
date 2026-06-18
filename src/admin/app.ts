import { RichBodyInput } from '../plugins/rich-body/admin/RichBodyInput'

export default {
  register(app: any) {
    app.customFields.register({
      name:      'rich-body',
      pluginId:  'rich-body',
      type:      'richtext',
      intlLabel: {
        id:             'rich-body.label',
        defaultMessage: 'Rich Body',
      },
      intlDescription: {
        id:             'rich-body.description',
        defaultMessage: 'Rich text with @mention support for players and clubs',
      },
      components: {
        Input: async () => ({ default: RichBodyInput }),
      },
    })
  },
}
