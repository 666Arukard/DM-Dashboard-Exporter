import test from 'node:test';
import assert from 'node:assert/strict';
import {gameFixture,configFixture} from './fixtures/details.mjs';
import {statblockFixture} from './fixtures/statblock.mjs';
import {exportCharacter,systemWarnings,assertEnvironment} from '../scripts/export-character.mjs';
import {characterDetails} from '../scripts/character-details.mjs';
import {monsterStatblock} from '../scripts/monster-statblock.mjs';
import {armorDetails} from '../scripts/export-item.mjs';
test('14.370 / 6.1.0 / DDB 7.6.2: Versionsfreigabe und vorbereitete Werte',()=>{
 const game=gameFixture();game.version='14.370';game.release.build=370;game.system.version='6.1.0';game.modules.set('ddb-importer',{version:'7.6.2'});
 const notices=[];globalThis.ui={notifications:{warn:x=>notices.push(x)}};
 try{assertEnvironment(game);assert.deepEqual(notices,[]);assert.deepEqual(systemWarnings(game),[]);
 const data=exportCharacter(game,'test-hero');assert.equal(data.source.foundryBuild,370);assert.equal(data.source.ddbImporterVersion,'7.6.2');assert.equal(data.character.armorClass,16);assert.equal(data.character.hp.current,17);assert.ok(!data.warnings.some(w=>/Foundry-Build/.test(w)));
 game.system.version='6.1.1';assert.equal(systemWarnings(game).length,1);game.system.version='6.1.0-beta.1';assert.equal(systemWarnings(game).length,1);
 }finally{delete globalThis.ui;}
});
test('6.1.0: spezielle Resistenzen und zusätzliche NPC-Anzeigen ohne Zahlenüberschreibung',()=>{
 const game=gameFixture(),actor=game.actors.get('test-hero');globalThis.CONFIG={DND5E:{...configFixture.DND5E,damageResistanceTypes:{falling:{label:'Sturzschaden'}}}};
 try{
 actor.system.traits.dr.value.add('falling');const details=characterDetails(game,actor,[]);assert.ok(details.resistances.values.some(v=>v.id==='falling'&&v.label==='Sturzschaden'));
 const f=statblockFixture();f.actor.flags={dnd5e:{statBlockOverride:{tempHP:'Test-Temp-HP',abilities:[{abilities:['str'],description:'Testbeschreibung'}]}}};const result=monsterStatblock(f.game,f.actor,[]);assert.ok(result.displayOverrides.some(v=>v.key==='tempHP'));assert.ok(result.displayOverrides.some(v=>v.key==='abilities'&&v.value.includes('Testbeschreibung')));assert.equal(result.abilities[0].score,20);
 assert.equal(armorDetails({type:'equipment',system:{type:{value:'heavy'},armor:{value:19,magicalBonus:'1'}}}).value,19);
 }finally{delete globalThis.CONFIG;}
});
