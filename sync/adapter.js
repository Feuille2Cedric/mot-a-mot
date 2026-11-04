(async () => {
  'use strict';
  const adapter = {
    app: 'mot-a-mot',
    empty: () => MotDomain.empty(),
    editing: () => false,
    syncWhileEditing: true,
    read: async () => MotApp.read(),
    current: () => MotApp.read(),
    imageIds: () => [],
    image: async () => null,
    export: document => ({format:'mot-a-mot', version:1, ...document}),
    validate: async document => MotDomain.validate(document),
    freeze: () => () => {},
    apply: async document => MotApp.apply(document)
  };
  window.motSync = new PersonalSync(adapter);
  try { await window.motSync.init(); MotApp.renderAll(); }
  catch (error) { window.motSync.message(`Synchronisation indisponible : ${error.message}`); }
})();
