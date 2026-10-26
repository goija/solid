#!/usr/bin/env bash
# Query PDOK BRK Kadastrale Kaart OGC API (EPSG:28992)
curl -s "https://api.pdok.nl/kadaster/brk-kadastrale-kaart/ogc/v1/collections/perceel/items?bbox=66000,396000,67000,397000&crs=http://www.opengis.net/def/crs/EPSG/0/28992&limit=5&f=json" | jq .
