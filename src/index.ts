import express from "express";
import { vectorTileInterface } from "./tile-interface";
import { IDatabase } from "pg-promise";

const tileLayerServer = function({ getTile, content_type, format, layer_id }) {
  // Small replacement for tessera
  const app = express().disable("x-powered-by");

  app.get(`/:z/:x/:y.${format}`, async function(req, res, next) {
    const z = req.params.z | 0;
    const x = req.params.x | 0;
    const y = req.params.y | 0;

    try {
      // Ignore headers that are also set by getTile
      const tile = await getTile({ z, x, y, layer_id });
      if (tile == null) {
        return res.status(404).send("Not found");
      }
      res.set({ "Content-Type": content_type });
      return res.status(200).send(tile);
    } catch (err) {
      return next(err);
    }
  });

  return app;
};

async function vectorTileServer(
  db: IDatabase<any>,
  layerName: string,
  opts = {}
) {
  const cfg = await vectorTileInterface(db, layerName, opts);
  return tileLayerServer(cfg);
}

export default vectorTileServer;
