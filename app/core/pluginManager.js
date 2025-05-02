const fs = require('fs');
const path = require('path');
const unzipper = require('unzipper');
const { app } = require('electron');
const crypto = require('crypto'); // For generating a unique ID

// Define the paths for plugins and metadata
const pluginDir = path.join(app.getPath('userData'), 'plugins');
const pluginMetadataPath = path.join(app.getPath('userData'), 'plugin.txt');

// Ensure plugins directory exists
if (!fs.existsSync(pluginDir)) {
    fs.mkdirSync(pluginDir, { recursive: true });
}

// Generate a unique plugin ID based on name, author, and passcode
function generatePluginId(name, author, passcode) {
    return crypto.createHash('sha256').update(name + author + passcode).digest('hex');
}

// Install a plugin (e.g., from a zip file)
function installPlugin(zipFilePath, passcode) {
    const pluginName = path.basename(zipFilePath, '.zip');
    const pluginInstallPath = path.join(pluginDir, pluginName);

    // Extract the zip file to the plugins directory
    fs.createReadStream(zipFilePath)
        .pipe(unzipper.Extract({ path: pluginInstallPath }))
        .on('close', () => {
            console.log(`Plugin ${pluginName} installed successfully at ${pluginInstallPath}`);

            // Check if plugin contains metadata
            const metadataPath = path.join(pluginInstallPath, 'plugin.json');
            if (!fs.existsSync(metadataPath)) {
                console.error(`Plugin ${pluginName} does not contain a valid metadata file.`);
                return;
            }

            // Read plugin metadata
            const pluginMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));

            // Check if passcode matches the metadata
            if (pluginMetadata.passcode !== passcode) {
                console.error("Invalid passcode. Installation denied.");
                return;
            }

            // Check if plugin already exists by name, author, and passcode
            if (isPluginDuplicate(pluginMetadata.name, pluginMetadata.author, pluginMetadata.passcode)) {
                console.log(`Plugin ${pluginMetadata.name} by ${pluginMetadata.author} is already installed.`);
                return; // If it's a duplicate, we skip installation.
            }

            // Generate a unique ID for the plugin
            const pluginId = generatePluginId(pluginMetadata.name, pluginMetadata.author, pluginMetadata.passcode);

            // Add the new plugin to plugin.txt (initially deactivated)
            const pluginData = {
                id: pluginId,
                name: pluginMetadata.name,
                active: false, // Set to inactive by default
                author: pluginMetadata.author,
                version: pluginMetadata.version
            };

            // Add the plugin to plugin.txt
            const pluginMetadataList = readPluginMetadata();
            pluginMetadataList.deactivated.push(pluginData);

            // Save updated plugin metadata
            savePluginMetadata(pluginMetadataList);
        });
}

// Update an existing plugin (if a new version is available)
function updatePlugin(pluginMetadata, passcode) {
    const pluginMetadataList = readPluginMetadata();

    // Check if the passcode matches the existing plugin's passcode
    if (pluginMetadata.passcode !== passcode) {
        console.error("Invalid passcode. Update denied.");
        return;
    }

    // Find and remove the old version of the plugin (by name, author, and passcode)
    const pluginId = generatePluginId(pluginMetadata.name, pluginMetadata.author, pluginMetadata.passcode);
    const index = pluginMetadataList.deactivated.findIndex(plugin => plugin.id === pluginId);
    if (index !== -1) {
        pluginMetadataList.deactivated.splice(index, 1);
    }

    // Add the updated plugin to deactivated (or active, based on the plugin state)
    const pluginData = {
        id: pluginId,
        name: pluginMetadata.name,
        active: false, // Set to inactive by default
        author: pluginMetadata.author,
        version: pluginMetadata.version
    };

    pluginMetadataList.deactivated.push(pluginData);

    // Save updated plugin metadata
    savePluginMetadata(pluginMetadataList);
    console.log(`Updated plugin ${pluginMetadata.name} to version ${pluginMetadata.version}.`);
}

// Read plugin metadata from plugin.txt
function readPluginMetadata() {
    if (fs.existsSync(pluginMetadataPath)) {
        const data = fs.readFileSync(pluginMetadataPath, 'utf-8');
        return parsePluginTxt(data);
    }
    return { active: [], deactivated: [] }; // Default structure if no plugin.txt exists
}

// Save updated plugin metadata back to plugin.txt
function savePluginMetadata(metadata) {
    const data = generatePluginTxt(metadata);
    fs.writeFileSync(pluginMetadataPath, data, 'utf-8');
}

// Convert plugin metadata object to plain text format
function generatePluginTxt(metadata) {
    let data = '[active]\n';
    metadata.active.forEach(plugin => data += `${plugin.id}\n`);

    data += '[deactivated]\n';
    metadata.deactivated.forEach(plugin => data += `${plugin.id}\n`);

    return data;
}

// Parse plugin.txt back into metadata object
function parsePluginTxt(txt) {
    const metadata = { active: [], deactivated: [] };
    const lines = txt.split('\n');
    let currentSection = null;

    lines.forEach(line => {
        line = line.trim();
        if (line === '[active]') {
            currentSection = 'active';
        } else if (line === '[deactivated]') {
            currentSection = 'deactivated';
        } else if (line) {
            metadata[currentSection].push(line);
        }
    });

    return metadata;
}

// Check if the plugin metadata exists by name, author, and passcode
function isPluginDuplicate(name, author, passcode) {
    const pluginMetadata = readPluginMetadata();

    // Generate a unique ID for the plugin using name, author, and passcode
    const pluginId = generatePluginId(name, author, passcode);

    return pluginMetadata.active.some(plugin => plugin.id === pluginId) ||
        pluginMetadata.deactivated.some(plugin => plugin.id === pluginId);
}

// Activate a plugin (move it from deactivated to active)
function activatePlugin(pluginId) {
    const pluginMetadata = readPluginMetadata();

    // Check if the plugin is in deactivated
    const index = pluginMetadata.deactivated.findIndex(plugin => plugin.id === pluginId);
    if (index === -1) {
        console.log(`Plugin with ID ${pluginId} not found in deactivated list.`);
        return;
    }

    // Move plugin to active
    const plugin = pluginMetadata.deactivated.splice(index, 1)[0];
    pluginMetadata.active.push(plugin);

    savePluginMetadata(pluginMetadata);
    console.log(`Activated plugin with ID: ${pluginId}`);
}

// Deactivate a plugin (move it from active to deactivated)
function deactivatePlugin(pluginId) {
    const pluginMetadata = readPluginMetadata();

    // Check if the plugin is in active
    const index = pluginMetadata.active.indexOf(pluginId);
    if (index === -1) {
        console.log(`Plugin with ID ${pluginId} not found in active list.`);
        return;
    }

    // Move plugin to deactivated
    pluginMetadata.active.splice(index, 1);
    pluginMetadata.deactivated.push({ id: pluginId });

    savePluginMetadata(pluginMetadata);
    console.log(`Deactivated plugin with ID: ${pluginId}`);
}

// Delete a plugin (remove it completely from disk and metadata)
function deletePlugin(pluginId) {
    const pluginMetadata = readPluginMetadata();

    // Check if the plugin is in active
    const activeIndex = pluginMetadata.active.indexOf(pluginId);
    const deactivatedIndex = pluginMetadata.deactivated.findIndex(plugin => plugin.id === pluginId);

    if (activeIndex === -1 && deactivatedIndex === -1) {
        console.log(`Plugin with ID ${pluginId} not found.`);
        return;
    }

    // Remove from active or deactivated list
    if (activeIndex !== -1) {
        pluginMetadata.active.splice(activeIndex, 1);
    } else {
        pluginMetadata.deactivated.splice(deactivatedIndex, 1);
    }

    // Delete the plugin folder
    const pluginPath = path.join(pluginDir, pluginId);
    fs.rmSync(pluginPath, { recursive: true, force: true });

    savePluginMetadata(pluginMetadata);
    console.log(`Deleted plugin with ID: ${pluginId}`);
}

module.exports = {
    installPlugin,
    updatePlugin,
    activatePlugin,
    deactivatePlugin,
    deletePlugin,
    isPluginDuplicate,
    readPluginMetadata,
    savePluginMetadata
};
