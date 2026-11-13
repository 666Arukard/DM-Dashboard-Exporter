from pathlib import Path
import json,re,zipfile,hashlib
ROOT=Path(__file__).resolve().parents[1]
manifest=json.loads((ROOT/'module.json').read_text(encoding='utf-8'))
version=manifest['version']
assert re.fullmatch(r'\d+\.\d+\.\d+',version)
assert manifest['id']=='dnd-dm-exporter'
assert manifest['download'].endswith('/v'+version+'/dnd-dm-exporter-'+version+'.zip')
assert f'MODULE_VERSION = "{version}"' in (ROOT/'scripts/export-character.mjs').read_text(encoding='utf-8')
files=[ROOT/'module.json',ROOT/'README.md',ROOT/'CHANGELOG.md',*sorted((ROOT/'scripts').glob('*.mjs')),*sorted((ROOT/'styles').glob('*.css')),*sorted((ROOT/'docs').glob('*.md'))]
for path in files:
 assert path.is_file() and not path.is_symlink()
 if path.suffix=='.mjs':
  for relative in re.findall(r'''(?:from\s*|import\s*)["'](\.[^"']+)["']''',path.read_text(encoding='utf-8-sig')):
   target=(path.parent/relative).resolve()
   assert target.is_relative_to(ROOT) and target in [p.resolve() for p in files],relative
out=ROOT/'dist';out.mkdir(exist_ok=True)
archive=out/f'dnd-dm-exporter-{version}.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
 for path in sorted(files):
  info=zipfile.ZipInfo('dnd-dm-exporter/'+path.relative_to(ROOT).as_posix(),(2026,1,1,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o644<<16
  z.writestr(info,path.read_bytes())
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None
 for path in files:assert z.read('dnd-dm-exporter/'+path.relative_to(ROOT).as_posix())==path.read_bytes()
(out/'module.json').write_bytes((ROOT/'module.json').read_bytes())
(out/'SHA256SUMS.txt').write_text(''.join(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+p.name+'\n' for p in [archive,out/'module.json']),encoding='utf-8')
print(f'Geprüft: {archive.name}, {len(files)} Dateien')
