import { readFileSync } from "fs";
import { IDatabase } from "pg-promise";

const queryFiles: { [k: string]: string } = {};

const sql = function(key: string) {
  // Don't hit the filesystem repeatedly
  // in a session
  const fn = require.resolve(`../procedures/${key}.sql`);
  if (queryFiles[fn] == null) {
    queryFiles[fn] = readFileSync(fn, "utf-8");
  }
  return queryFiles[fn];
};

const interfaceFactory = async function(
  db: IDatabase<null>,
  layerName: string,
  opts,
  buildTile
) {
  const { verbose = false } = opts;
  const { id: layer_id, content_type, format } = await db.one(
    sql("get-layer-metadata"),
    { name: layerName }
  );

  const getTile = async function(tileArgs) {
    const { z, x, y } = tileArgs;
    const params = { ...tileArgs, layer_id };
    const res = await db.oneOrNone(sql("get-tile"), params);
    if (res?.tile == null) {
      if (verbose) {
        console.log(`Creating tile (${z},${x},${y}) for layer ${name}`);
      }
      const newTile = await buildTile(tileArgs);
      db.none(sql("set-tile"), { z, x, y, newTile, layer_id });
      return newTile;
    } else {
      return res.tile;
    }
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
