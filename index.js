/*
This file is part of the Nervatura Framework
http://www.nervatura.com
Copyright © 2011-2017, Csaba Kappel
License: LGPLv3
https://raw.githubusercontent.com/nervatura/nervatura/master/LICENSE
*/

'use strict';

var readFileSync = require('fs').readFileSync;
var path = require('path');
var ejs = require('ejs')

var out = require('nervatura').tools.DataOutput()
var Lang = require('nervatura').lang
var Conf = require('nervatura').conf
var basicStore = require('nervatura').storage.basicStore
var Nervastore = require('nervatura').nervastore

var Ndi = require('nervatura').ndi;
var Npi = require('nervatura').npi;
var Nas = require('nervatura').nas;

exports.handler = (event, context, callback) => {

  function render(file, data, dir){
    dir = dir || "template"
    var template = path.join(out.getValidPath(),"..","views",dir,file)
    return ejs.compile(readFileSync(template, 'utf8'), {
      filename: template})(data); }

  function sendResult(params){
    switch (params.type) {
      case "error":
        return callback(null, {
          statusCode: '200',
          body: JSON.stringify({"id":params.id || -1, "jsonrpc": "2.0", 
            "error": {"code": params.ekey, "message": params.err_msg, "data": params.data}}),
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'OPTIONS, GET, DELETE, POST, PUT, HEAD, PATCH',
            'Access-Control-Allow-Headers':' Authorization, Content-Type',
            'Content-Type': 'application/json; charset=utf-8' }});
      
      case "csv":
        return callback(null, {
          statusCode: '200',
          body: params.data,
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment;filename='+params.filename+'.csv' }});
      
      case "html":
        return callback(null, {
          statusCode: '200',
          body: render(params.tempfile, params.data, params.dir),
          headers: {
            'Content-Type': 'text/html' }});
      
      case "xml":
        return callback(null, {
          statusCode: '200',
          body: render(params.tempfile, params.data),
          headers: {
            'Content-Type': 'text/xml' }});
      
      case "json":
        return callback(null, {
          statusCode: '200',
          body: JSON.stringify({"id": params.id, "jsonrpc": "2.0", "result": params.data}),
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'OPTIONS, GET, DELETE, POST, PUT, HEAD, PATCH',
            'Access-Control-Allow-Headers': 'Authorization, Content-Type',
            'Content-Type': 'application/json; charset=utf-8',
            'Data-Type': 'json; charset=utf-8' }});

      default:
        return callback(null, {
          statusCode: '200',
          body: JSON.stringify(params),
          headers: { 'Content-Type': 'text/json' } });
      }
  }
  
  var databases = require('./lib/databases.json');
  var conf = Conf(params); var lang = Lang[conf.lang]
  
  var storage = basicStore({ data_store: conf.data_store, databases: databases,
    conf: conf, lang: lang, data_dir: conf.data_dir, host_type: conf.host_type});
  var nstore = Nervastore({ 
    conf: conf, data_dir: conf.data_dir, report_dir: conf.report_dir,
    host_ip: "", host_settings: conf.def_settings, storage: storage,
    lang: lang });

  switch (event.path) {
    case "/ndi/getVernum":
      var version = require('./package.json').version+'-NJS/LAMBDA';
      return sendResult(version);
    
    case "/ndi/jsonrpc":
    case "/ndi/jsonrpc2":
      return Ndi(lang).getApi(nstore, event.body, function(result){
        sendResult(result); });
    
    case "/ndi/updateData":
    case "/ndi/deleteData":
    case "/ndi/getData":
      event.queryStringParameters.method = String(event.path).replace("/ndi/","")
      return Ndi(lang).getApi(nstore, event.body, function(result){
        sendResult(event.queryStringParameters); });
    
    case "/npi/call/jsonrpc":
    case "/npi/call/jsonrpc2":
    case "/npi/jsonrpc":
    case "/npi/jsonrpc2":
      return Npi(lang).getApi(nstore, event.body, function(result){
        sendResult(result); });
    
    case "/nas/database/create":
    case "/nas/database/demo":
    case "/nas/report/list":
    case "/nas/report/delete":
    case "/nas/report/install":
      var _params = (event.method === "POST") ? event.body : event.queryStringParameters;
      _params.method = String(event.path).replace("/nas/","")
      return Nas().getApi(nstore, _params, function(result){
        sendResult(result); });

    default:
      return sendResult({type:"error", id:-1, ekey:"invalid", err_msg: "Invalid path"});
  }

}
