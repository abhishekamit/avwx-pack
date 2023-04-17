import * as coda from "@codahq/packs-sdk";

export const pack = coda.newPack();

pack.setUserAuthentication({ type: coda.AuthenticationType.HeaderBearerToken });
pack.addNetworkDomain('avwx.rest');

const LineItemSchema = coda.makeObjectSchema({
  properties: {
    repr: { type: coda.ValueType.String },
    value: { type: coda.ValueType.String },
  }
});


pack.addFormula({
  name: "Summary",
  description: "The summary provides the current and future flight conditions as well as a few other elements to explain them.",

  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "location",
      description: "ICAO & IATA station code or coordinate pair.",
    }),
  ],

  resultType: coda.ValueType.Object,
  schema: coda.makeObjectSchema({
    type: coda.ValueType.Object,
    properties: {
      meta: coda.makeObjectSchema({
        properties: {
          timestamp: { type: coda.ValueType.String, codaType: coda.ValueHintType.DateTime },
        },
      }),
      metar: coda.makeObjectSchema({
        properties: {
          time: { type: coda.ValueType.String, codaType: coda.ValueHintType.DateTime },
          flight_rules: { type: coda.ValueType.String },
          wx_codes: {
            type: coda.ValueType.Array,
            items: LineItemSchema,
          },
          visibility: LineItemSchema,
          ceiling: coda.makeObjectSchema({
            properties: {
              repr: { type: coda.ValueType.String },
              type: { type: coda.ValueType.String },
              altitude: { type: coda.ValueType.Number },
              modifier: { type: coda.ValueType.String },
            },
          }),
        },
      }),
      taf: coda.makeObjectSchema({
        properties: {
          time: { type: coda.ValueType.String, codaType: coda.ValueHintType.DateTime },
          forecast: {
            type: coda.ValueType.Array,
            items: coda.makeObjectSchema({
              properties: {
                start_time: { type: coda.ValueType.String, codaType: coda.ValueHintType.DateTime },
                end_time: { type: coda.ValueType.String, codaType: coda.ValueHintType.DateTime },
                flight_rules: { type: coda.ValueType.String },
              },
            }),
          },
        },
      }),
    },
  }),
  execute: async function ([location], context) {
    const url = `https://avwx.rest/api/summary/${location}`;
    const response = await context.fetcher.fetch({
      method: "GET",
      url,
    });

    if (response.status !== 200) {
      throw new Error("Failed to fetch airport information");
    }
    return response.body;
  },
});

const RunwaySchema = coda.makeObjectSchema({
  name: "Runway",
  properties: {
    length_ft: { type: coda.ValueType.Number },
    width_ft: { type: coda.ValueType.Number },
    ident1: { type: coda.ValueType.String },
    ident2: { type: coda.ValueType.String },
    name: { type: coda.ValueType.String },
  },
  displayProperty: "name",
});

const StationSchema = coda.makeObjectSchema({
  properties: {
    city: { type: coda.ValueType.String },
    country: { type: coda.ValueType.String },
    elevation_ft: { type: coda.ValueType.Number },
    elevation_m: { type: coda.ValueType.Number },
    gps: { type: coda.ValueType.String },
    iata: { type: coda.ValueType.String },
    icao: { type: coda.ValueType.String },
    latitude: { type: coda.ValueType.Number },
    local: { type: coda.ValueType.String },
    longitude: { type: coda.ValueType.Number },
    name: { type: coda.ValueType.String },
    note: { type: coda.ValueType.String },
    reporting: { type: coda.ValueType.Boolean },
    runways: {
      type: coda.ValueType.Array,
      items: RunwaySchema,
    },
    state: { type: coda.ValueType.String },
    type: { type: coda.ValueType.String },
    website: { type: coda.ValueType.String, codaType: coda.ValueHintType.Url },
    wiki: { type: coda.ValueType.String, codaType: coda.ValueHintType.Url },
  },
  displayProperty: "name",
});

pack.addFormula({
  name: 'Station',
  description: 'Returns station information for an airfield or other location by ICAO ident.',
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: 'ident',
      description: 'ICAO or IATA station code Example: KJFK',
    }),
  ],
  resultType: coda.ValueType.Object,
  schema: StationSchema,
  execute: async function ([ident], context) {
    const url = `https://avwx.rest/api/station/${ident}`;
    const response = await context.fetcher.fetch({
      method: "GET",
      url,
    });

    if (response.status !== 200) {
      throw new Error("Failed to fetch airport information");
    }
    response.body.runways.map((runway) => {
      runway.name = `${runway.ident1}/${runway.ident2}`;
    });
    return response.body;
  },
});


pack.addFormula({
  name: 'NearestStations',
  description: 'Returns the nearest stations to a coordinate pair.',
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.Number,
      name: 'latitude',
      description: 'Latitude',
    }),
    coda.makeParameter({
      type: coda.ParameterType.Number,
      name: 'longitude',
      description: 'Longitude',
    }),
    coda.makeParameter({
      type: coda.ParameterType.Number,
      name: 'n',
      description: 'Number of stations to return',
      optional: true,
    }),
  ],
  resultType: coda.ValueType.Array,
  items: coda.makeObjectSchema({
    properties: {
      station: StationSchema,
      coordinate_distance: { type: coda.ValueType.Number },
      nautical_miles: { type: coda.ValueType.Number },
      miles: { type: coda.ValueType.Number },
      kilometers: { type: coda.ValueType.Number },
    },
  }),
  execute: async function ([latitude, longitude, n], context) {
    const url = coda.withQueryParams(`https://avwx.rest/api/station/near/${latitude},${longitude}`, { n });
    const response = await context.fetcher.fetch({
      method: "GET",
      url,
    });

    if (response.status !== 200) {
      throw new Error("Failed to fetch airport information");
    }
    response.body.map((station) => {
      station.station.runways?.map((runway) => {
        runway.name = `${runway.ident1}/${runway.ident2}`;
      });
    });
    return response.body;
  },
});

pack.addFormula({
  name: 'StationSearch',
  description: 'Text search for stations by ICAO, IATA, name, city, and state.',
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: 'text',
      description: 'Search text',
    }),
    coda.makeParameter({
      type: coda.ParameterType.Number,
      name: 'n',
      description: 'Number of stations to return',
      optional: true,
    }),
  ],
  resultType: coda.ValueType.Array,
  items: StationSchema,
  execute: async function ([text, n], context) {
    const url = coda.withQueryParams(`https://avwx.rest/api/search/station`, { text, n });
    const response = await context.fetcher.fetch({
      method: "GET",
      url,
    });

    if (response.status !== 200) {
      throw new Error("Failed to fetch airport information");
    }
    response.body.map((station) => {
      station.runways?.map((runway) => {
        runway.name = `${runway.ident1}/${runway.ident2}`;
      });
    });
    return response.body;
  },
});

const CloudsSchema = coda.makeObjectSchema({
  properties: {
    repr: { type: coda.ValueType.String },
    type: { type: coda.ValueType.String },
    altitude: { type: coda.ValueType.Number },
    modifier: { type: coda.ValueType.String },
    direction: { type: coda.ValueType.String },
  },
});

const TimeSchema = coda.makeObjectSchema({
  properties: {
    repr: { type: coda.ValueType.String },
    dt: { type: coda.ValueType.String, codaType: coda.ValueHintType.DateTime },
  },
});

pack.addFormula({
  name: 'Metar',
  description: 'Returns the METAR for a station.',
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: 'location',
      description: 'ICAO, IATA station code or coordinate pair. Example: KJFK or 40.639801,-73.778900',
    }),
  ],
  resultType: coda.ValueType.Object,
  schema: coda.makeObjectSchema({
    properties: {
      meta: coda.makeObjectSchema({
        properties: {
          timestamp: { type: coda.ValueType.String, codaType: coda.ValueHintType.DateTime },
        },
      }),
      altimeter: coda.makeObjectSchema({
        properties: {
          repr: { type: coda.ValueType.String },
          value: { type: coda.ValueType.Number },
          spoken: { type: coda.ValueType.String },
        },
      }),
      clouds: {
        type: coda.ValueType.Array,
        items: CloudsSchema,
      },
      flight_rules: { type: coda.ValueType.String },
      other: { type: coda.ValueType.Array, items: { type: coda.ValueType.String } },
      sanitized: { type: coda.ValueType.String },
      visibility: LineItemSchema,
      wind_direction: LineItemSchema,
      wind_gust: LineItemSchema,
      wind_speed: LineItemSchema,
      wx_codes: {
        type: coda.ValueType.Array,
        items: LineItemSchema,
      },
      raw: { type: coda.ValueType.String },
      station: { type: coda.ValueType.String },
      time: TimeSchema,
      remarks: { type: coda.ValueType.String },
      dewpoint: LineItemSchema,
      relative_humidity: { type: coda.ValueType.Number },
      remarks_info: coda.makeObjectSchema({
        properties: {
          maximum_temperature_6: { type: coda.ValueType.Number },
          minimum_temperature_6: { type: coda.ValueType.Number },
          pressure_tendency: { type: coda.ValueType.Number },
          precip_36_hours: { type: coda.ValueType.Number },
          precip_24_hours: { type: coda.ValueType.Number },
          sunshine_minutes : { type: coda.ValueType.Number },
          codes: {
            type: coda.ValueType.Array,
            items: LineItemSchema,
          },
          dewpoint_decimal: LineItemSchema,
          maximum_temperature_24: { type: coda.ValueType.Number },
          minimum_temperature_24: { type: coda.ValueType.Number },
          precip_hourly: { type: coda.ValueType.Number },
          sea_level_pressure: LineItemSchema,
          snow_depth: { type: coda.ValueType.Number },
          temperature_decimal: LineItemSchema,
        },
      }),
      runway_visibility: {
        type: coda.ValueType.Array,
        items: {type: coda.ValueType.String},
      },
      temperature: LineItemSchema,
      wind_variable_direction: {
        type: coda.ValueType.Array,
        items: { type: coda.ValueType.String },
      },
      density_altitude: { type: coda.ValueType.Number },
      pressure_altitude: { type: coda.ValueType.Number },
      units: coda.makeObjectSchema({
        properties: {
          accumulation: { type: coda.ValueType.String },
          altimeter: { type: coda.ValueType.String },
          altitude: { type: coda.ValueType.String },
          temperature: { type: coda.ValueType.String },
          visibility: { type: coda.ValueType.String },
          wind_speed: { type: coda.ValueType.String },
        },
      }),
    },
  }),
  execute: async function ([location], context) {
    const url = coda.withQueryParams(`https://avwx.rest/api/metar/${location}`, {});
    const response = await context.fetcher.fetch({
      method: "GET",
      url,
    });

    if (response.status !== 200) {
      throw new Error("Failed to fetch airport information");
    }
    return response.body;
  },
});

pack.addFormula({
  name: 'Taf',
  description: 'TAF reports are atmospheric conditions for an area within five nautical miles of a particular airfield or other station location.',
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: 'location',
      description: 'ICAO, IATA station code, or coordinate pair',
    }),
  ],
  resultType: coda.ValueType.Object,
  schema: coda.makeObjectSchema({
    properties: {
      meta: coda.makeObjectSchema({
        properties: {
          timestamp: { type: coda.ValueType.String, codaType: coda.ValueHintType.DateTime },
        },
      }),
      raw: { type: coda.ValueType.String },
      station: { type: coda.ValueType.String },
      time: TimeSchema,
      remarks: { type: coda.ValueType.String },
      forecast: {
        type: coda.ValueType.Array,
        items: coda.makeObjectSchema({
          properties: {
            altimeter: { type: coda.ValueType.Number },
            clouds: {
              type: coda.ValueType.Array,
              items: CloudsSchema,
            },
            flight_rules: { type: coda.ValueType.String },
            other: { type: coda.ValueType.Array, items: { type: coda.ValueType.String } },
            sanitized: { type: coda.ValueType.String },
            visibility: LineItemSchema,
            wind_direction: LineItemSchema,
            wind_gust: LineItemSchema,
            wind_speed: LineItemSchema,
            wx_codes: {
              type: coda.ValueType.Array,
              items: LineItemSchema,
            },
            end_time: TimeSchema,
            icing: {
              type: coda.ValueType.Array,
              items: {type: coda.ValueType.String},
            },
            probability: { type: coda.ValueType.Number },
            raw: { type: coda.ValueType.String },
            start_time: TimeSchema,
            turbulence: {
              type: coda.ValueType.Array,
              items: {type: coda.ValueType.String},
            },
            type: { type: coda.ValueType.String },
            wind_shear: { type: coda.ValueType.String },
            summary: { type: coda.ValueType.String },
          },
          displayProperty: 'sanitized',
        }),
      },
    },
  }),
  execute: async function ([location], context) {
    const url = coda.withQueryParams(`https://avwx.rest/api/taf/${location}`, { });
    const response = await context.fetcher.fetch({
      method: "GET",
      url,
    });

    if (response.status !== 200) {
      throw new Error("Failed to fetch airport information");
    }
    return response.body;
  },
});