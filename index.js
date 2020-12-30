const Runtime = require('php-runtime');
const phar = require('phar-stream');
const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

class PharComp {
    constructor(api) {
        this.api = api;
        this.runtime = new Runtime({
            core: {
                config: {
                    extensions: ['php-core']
                }
            }
        });
    }

    async onEnable() {
        this.api.getLogger().info('§aSuccessfully Loaded PMMP compatibility layer!§r');

        const pluginFiles = fs.readdirSync(path.join(process.cwd(), 'plugins'));
        const plugins = (await Promise.all(pluginFiles.map(async (file) => {
            return new Promise((resolve) => {
                if (!file.includes('.phar'))
                    return resolve();

                const extract = new phar.extract();
                const files = {};

                extract.on('entry', (header, stream, next) => {
                    if (header.entry_name === '.poggit')
                        return next();

                    const chunks = [];
                    stream.on('data', chunk => chunks.push(chunk))
                    stream.on('end', () => {
                        files[header.entry_name] = Buffer.concat(chunks).toString('utf8');
                        next();
                    });
                });

                extract.on('finish', () => {
                    const config = YAML.parse(files['plugin.yml']);
                    resolve({
                        name: config.name,
                        version: config.version,
                        description: config.description,
                        main: config.main,
                        files
                    });
                });

                const archive = fs.createReadStream(path.join(process.cwd(), 'plugins', file));
                archive.pipe(extract);
            });
        }))).filter(a => a);

        plugins.forEach(async (plugin) => {
            const runtime = this.runtime;

            this.api.getServer().getPluginManager().registerClassPlugin(plugin, new (class Plugin {
                getName() {
                    return plugin.name;
                }
                getDisplayName() {
                    return plugin.name;
                }
                getVersion() {
                    return plugin.version;
                }
                async onEnable() {
                    // runtime.eval(plugin.files[`src/${plugin.main.replace('\\', '/')}.php`]);
                }
                async onDisable() { }
            })());
        })
    }

    async onDisable() {
        this.api.getLogger().info('§cPlugin Disabled.§r');
    }
}

module.exports.default = PharComp;
