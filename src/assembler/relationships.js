/**
 * Relationships Manager - управление файлом document.xml.rels
 */

const REL_TYPES = {
  hyperlink: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink',
  image: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
  header: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/header',
  footer: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer',
  styles: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles',
  numbering: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering',
  settings: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings',
  webSettings: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/webSettings',
  fontTable: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable',
  footnotes: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes',
  endnotes: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/endnotes',
  theme: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme'
};

class RelationshipsManager {
  constructor() {
    this.relationships = [];
    this.nextId = 1;
  }
  
  loadFromXml(xml) {
    const relRegex = /<Relationship\s+Id="([^"]+)"\s+Type="([^"]+)"\s+Target="([^"]+)"(?:\s+TargetMode="([^"]+)")?\s*\/>/g;
    
    let match;
    while ((match = relRegex.exec(xml)) !== null) {
      const id = match[1];
      const type = match[2];
      const target = match[3];
      const targetMode = match[4] || null;
      
      this.relationships.push({ id, type, target, targetMode });
      
      const idNum = parseInt(id.replace('rId', ''), 10);
      if (!isNaN(idNum) && idNum >= this.nextId) {
        this.nextId = idNum + 1;
      }
    }
  }
  
  getNextId() {
    return `rId${this.nextId++}`;
  }
  
  addHyperlink(url) {
    const existing = this.relationships.find(
      r => r.type === REL_TYPES.hyperlink && r.target === url
    );
    
    if (existing) return existing.id;
    
    const id = this.getNextId();
    this.relationships.push({
      id, type: REL_TYPES.hyperlink, target: url, targetMode: 'External'
    });
    
    return id;
  }
  
  addImage(imagePath) {
    const existing = this.relationships.find(
      r => r.type === REL_TYPES.image && r.target === imagePath
    );
    
    if (existing) return existing.id;
    
    const id = this.getNextId();
    this.relationships.push({
      id, type: REL_TYPES.image, target: imagePath, targetMode: null
    });
    
    return id;
  }
  
  getByType(type) {
    return this.relationships.filter(r => r.type === type);
  }
  
  getById(id) {
    return this.relationships.find(r => r.id === id) || null;
  }
  
  toXml() {
    const rels = this.relationships.map(rel => {
      let attrs = `Id="${rel.id}" Type="${rel.type}" Target="${rel.target}"`;
      if (rel.targetMode) {
        attrs += ` TargetMode="${rel.targetMode}"`;
      }
      return `  <Relationship ${attrs}/>`;
    }).join('\n');
    
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${rels}
</Relationships>`;
  }
  
  getCurrentNextId() {
    return this.nextId;
  }
}

function createBaseRelationships() {
  const manager = new RelationshipsManager();

  manager.relationships = [
    { id: 'rId1', type: REL_TYPES.numbering, target: 'numbering.xml', targetMode: null },
    { id: 'rId2', type: REL_TYPES.styles, target: 'styles.xml', targetMode: null },
    { id: 'rId3', type: REL_TYPES.settings, target: 'settings.xml', targetMode: null },
    { id: 'rId4', type: REL_TYPES.webSettings, target: 'webSettings.xml', targetMode: null },
    { id: 'rId5', type: REL_TYPES.fontTable, target: 'fontTable.xml', targetMode: null },
    { id: 'rId6', type: REL_TYPES.footnotes, target: 'footnotes.xml', targetMode: null },
    { id: 'rId7', type: REL_TYPES.endnotes, target: 'endnotes.xml', targetMode: null },
    { id: 'rId8', type: REL_TYPES.theme, target: 'theme/theme1.xml', targetMode: null }
  ];

  manager.nextId = 9;

  return manager;
}

module.exports = { RelationshipsManager, createBaseRelationships, REL_TYPES };
