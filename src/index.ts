import { readFileSync } from "fs";

const queryFiles: { [k: string]: string } = {};

const sql = function(key: string) {
  // Don't hit the filesystem repeatedly
  // in a session
  const fn = require.resolve(`../procedures/${key}.sql`);
  if (queryFiles[fn] == null) {
    queryFiles[fn] = readFileSync(fn, "UTF-8");
  }
  return queryFiles[fn];
};

const interfaceFactory = async function(db, layerName, opts, buildTile) {
  let { silent = false } = opts;
  const log = silent ? function() {} : console.log;
  const { id: layer_id, content_type, format } = await db.one(
    sql("get-layer-metadata"),
    { name: layerName }
  );
  const q = sql("get-tile");
  const q2 = sql("set-tile");
  const getTile = async function(tileArgs) {
    const { z, x, y } = tileArgs;
    let { tile } = (await db.oneOrNone(q, { ...tileArgs, layer_id })) || {};
    if (tile == null) {
      log(`Creating tile (${z},${x},${y}) for layer ${name}`);
      tile = await buildTile(tileArgs);
      db.none(q2, { z, x, y, tile, layer_id });
    }
    return tile;
  };
  return { getTile, content_type, format, layer_id };
};

const vectorTileInterface = function(db, layer, opts = {}) {
  const q = sql("get-vector-tile");
  return interfaceFactory(db, layer, opts, async function(tileArgs) {
    const { tile } = await db.one(q, tileArgs);
    return tile;
  });
};

export { interfaceFactory, vectorTileInterface };
