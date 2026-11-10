(function () {
  function ask(op, payload) {
    var raw = window.prompt('leaflight:' + op, payload == null ? '' : JSON.stringify(payload));
    if (!raw) return null;
    try { return JSON.parse(raw).value; } catch (error) { return null; }
  }
  function post(op, payload) {
    var message = payload || {};
    message.op = op;
    window.webkit.messageHandlers.leaflight.postMessage(message);
  }
  window.ReaderNative = {
    hasKey: function () { return !!ask('hasKey'); },
    getGeminiProvider: function () { return ask('getGeminiProvider') || 'gemini'; },
    saveKey: function (key) { return !!ask('saveKey', {key: key || ''}); },
    saveGeminiSettings: function (key, provider) { return !!ask('saveGeminiSettings', {key: key || '', provider: provider || 'gemini'}); },
    removeKey: function () { ask('removeKey'); },
    beginGeneration: function (id) { return !!ask('beginGeneration', {id: id}); },
    endGeneration: function (id) { ask('endGeneration', {id: id}); },
    cancelGeneration: function (id) { ask('cancelGeneration', {id: id}); },
    generate: function (id, model, body, session) { post('generate', {id: id, model: model, body: body, session: session}); },
    exportBackup: function (json) { post('exportBackup', {json: json}); },
    exportStory: function (filename, json) { post('exportStory', {filename: filename, json: json}); },
    prepareSharePackage: function (filename, json, url) { post('prepareSharePackage', {filename: filename, json: json, url: url}); },
    fetchPool: function (repo) { post('fetchPool', {repo: repo}); },
    fetchPoolStory: function (id, poolId) { post('fetchPoolStory', {id: id, poolId: poolId}); },
    copyAndOpenUrl: function (text, url) { return !!ask('copyAndOpenUrl', {text: text || '', url: url || ''}); }
  };
})();
