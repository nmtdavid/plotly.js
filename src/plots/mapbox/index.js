/**
* Copyright 2012-2019, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/

'use strict';

var mapboxgl = require('mapbox-gl');

var Lib = require('../../lib');
var getSubplotCalcData = require('../../plots/get_data').getSubplotCalcData;
var xmlnsNamespaces = require('../../constants/xmlns_namespaces');

var Mapbox = require('./mapbox');

var MAPBOX = 'mapbox';

var constants = exports.constants = require('./constants');

exports.name = MAPBOX;

exports.attr = 'subplot';

exports.idRoot = MAPBOX;

exports.idRegex = exports.attrRegex = Lib.counterRegex(MAPBOX);

exports.attributes = {
    subplot: {
        valType: 'subplotid',
        role: 'info',
        dflt: 'mapbox',
        editType: 'calc',
        description: [
            'Sets a reference between this trace\'s data coordinates and',
            'a mapbox subplot.',
            'If *mapbox* (the default value), the data refer to `layout.mapbox`.',
            'If *mapbox2*, the data refer to `layout.mapbox2`, and so on.'
        ].join(' ')
    }
};

exports.layoutAttributes = require('./layout_attributes');

exports.supplyLayoutDefaults = require('./layout_defaults');

exports.plot = function plot(gd) {
    var fullLayout = gd._fullLayout;
    var calcData = gd.calcdata;
    var mapboxIds = fullLayout._subplots[MAPBOX];

    if(mapboxgl.version !== constants.requiredVersion) {
        throw new Error(constants.wrongVersionErrorMsg);
    }

    var accessToken = findAccessToken(gd, mapboxIds);
    mapboxgl.accessToken = accessToken;

    for(var i = 0; i < mapboxIds.length; i++) {
        var id = mapboxIds[i];
        var subplotCalcData = getSubplotCalcData(calcData, MAPBOX, id);
        var opts = fullLayout[id];
        var mapbox = opts._subplot;

        if(!mapbox) {
            mapbox = new Mapbox(gd, id);
            fullLayout[id]._subplot = mapbox;
        }

        if(!mapbox.viewInitial) {
            mapbox.viewInitial = {
                center: Lib.extendFlat({}, opts.center),
                zoom: opts.zoom,
                bearing: opts.bearing,
                pitch: opts.pitch
            };
        }

        mapbox.plot(subplotCalcData, fullLayout, gd._promises);
    }
};

exports.clean = function(newFullData, newFullLayout, oldFullData, oldFullLayout) {
    var oldMapboxKeys = oldFullLayout._subplots[MAPBOX] || [];

    for(var i = 0; i < oldMapboxKeys.length; i++) {
        var oldMapboxKey = oldMapboxKeys[i];

        if(!newFullLayout[oldMapboxKey] && !!oldFullLayout[oldMapboxKey]._subplot) {
            oldFullLayout[oldMapboxKey]._subplot.destroy();
        }
    }
};

exports.toSVG = function(gd) {
    var fullLayout = gd._fullLayout;
    var subplotIds = fullLayout._subplots[MAPBOX];
    var size = fullLayout._size;

    for(var i = 0; i < subplotIds.length; i++) {
        var opts = fullLayout[subplotIds[i]];
        var domain = opts.domain;
        var mapbox = opts._subplot;

        var imageData = mapbox.toImage('png');
        var image = fullLayout._glimages.append('svg:image');

        image.attr({
            xmlns: xmlnsNamespaces.svg,
            'xlink:href': imageData,
            x: size.l + size.w * domain.x[0],
            y: size.t + size.h * (1 - domain.y[1]),
            width: size.w * (domain.x[1] - domain.x[0]),
            height: size.h * (domain.y[1] - domain.y[0]),
            preserveAspectRatio: 'none'
        });

        mapbox.destroy();
    }
};

// N.B. mapbox-gl only allows one accessToken to be set per page:
// https://github.com/mapbox/mapbox-gl-js/issues/6331
function findAccessToken(gd, mapboxIds) {
    var fullLayout = gd._fullLayout;
    var context = gd._context;

    // special case for Mapbox Atlas users
    if(context.mapboxAccessToken === '') return '';

    var tokensUseful = [];
    var tokensListed = [];
    var wontWork = false;

    // Take the first token we find in a mapbox subplot.
    // These default to the context value but may be overridden.
    for(var i = 0; i < mapboxIds.length; i++) {
        var opts = fullLayout[mapboxIds[i]];
        var style = opts.style;
        var token = opts.accesstoken;

        if(typeof style === 'string' && constants.styleValuesMapbox.indexOf(style) !== -1) {
            if(token) {
                Lib.pushUnique(tokensUseful, token);
            } else {
                Lib.error('Uses Mapbox map style, but did not set an access token.');
                wontWork = true;
            }
        }

        if(token) {
            Lib.pushUnique(tokensListed, token);
        }
    }

    if(wontWork) {
        throw new Error(constants.noAccessTokenErrorMsg);
    }

    if(tokensUseful.length) {
        if(tokensUseful.length > 1) {
            Lib.warn(constants.multipleTokensErrorMsg);
        }
        return tokensUseful[0];
    } else {
        if(tokensListed.length) {
            Lib.log([
                'Listed mapbox access token(s)', tokensListed.join(','),
                'but did not use a Mapbox map style, ignoring token(s).'
            ].join(' '));
        }
        return '';
    }
}

exports.updateFx = function(gd) {
    var fullLayout = gd._fullLayout;
    var subplotIds = fullLayout._subplots[MAPBOX];

    for(var i = 0; i < subplotIds.length; i++) {
        var subplotObj = fullLayout[subplotIds[i]]._subplot;
        subplotObj.updateFx(fullLayout);
    }
};
