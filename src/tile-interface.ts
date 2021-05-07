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

type Database = IDatabase<any>;

type TileArgs = { z: number; x: number; y: number };

interface TileInterface {
  getTile(k: TileArgs & { layer_id: string }): Promise<any>;
  layer_id: string;
  content_type: string;
  format: string;
}

const interfaceFactory = async function(
  db: Database,
  layerName: string,
  opts: any,
  buildTile: (args: TileArgs) => any
) {
  const { verbose = false } = opts;
  const { id: layer_id, content_type, format } = await db.one(
    sql("get-layer-metadata"),
    { name: layerName }
  );

  const getTile = async function(tileArgs: TileArgs): Promise<TileInterface> {
    const { z, x, y } = tileArgs;
    const params = { ...tileArgs, layer_id };
    try {
      const res = await db.oneOrNone(sql("get-tile"), params);
      if (res?.tile == null) {
        if (verbose) {
          console.log(`Creating tile (${z},${x},${y}) for layer ${name}`);
        }
        const newTile = await buildTile(tileArgs);
        console.log("Built tile", newTile);
        await db.none(sql("set-tile"), { z, x, y, tile: newTile, layer_id });
        return newTile;
      } else {
        return res.tile;
      }
    } catch (err) {
      throw err;
    }
  };
  return { getTile, content_type, format, layer_id };
};

const vectorTileInterface = function(
  db: Database,
  layerName: string,
  opts = {}
) {
  const q = sql("get-vector-tile");
  return interfaceFactory(db, layerName, opts, async function(tileArgs) {
    const { tile } = await db.one(q, tileArgs);
    return tile;
  });
};

export {
  interfaceFactory,
  vectorTileInterface,
  TileArgs,
  Database,
  TileInterface
};
