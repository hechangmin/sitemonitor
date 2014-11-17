/**
 * 检查服务端接口质量
 * 
 * @author hechangmin
 * @date 2014.11.13
 */

(function App(configs){
    var http = require('http');
    var querystring = require('querystring');
    var mysql = require('mysql');
    var moment = require('moment');
    var domain = require('domain');

    var taskList = configs.task;
    var logoutTask = taskList.shift();
    var loginTask = taskList.shift();
    var myTimer, retList = [], token = '', doing = false;

    require('todo4js');

    function quit(err){
        try {
            console.error('server carsh\r\n', err);
            var killTimer = setTimeout(function () {
                process.exit(1);
            });
            myTimer.unref();
            killTimer.unref();
        } catch (e) {
            console.error('error when quit()：', e.stack);
        }
    }

    function sendData(options, callback){
        var params = options.params || '';
        var post_data = querystring.stringify(params);
        var startTime = +new Date();

        var retItem = {
            url : options.url,
            time : startTime,
            params : params,
            method : options.method || 'POST',
            msg : '',
            jsonRet : ''
        };
        
        var opts = {
            host : configs.host,
            port : configs.port,
            path : options.url,
            method : options.method || 'POST',
            headers : {
                'Cookie' : token,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': post_data.length
            }
        };
        
        var req = http.request(opts, function(res) {
            var size = 0;
            var chunks = []; 
            var cookie;
            
            cookie = res.headers['set-cookie'] || [''];
            token = cookie[0].split(';')[0] || token;

            res.on('data', function(chunk){
                size += chunk.length;
                chunks.push(chunk);
            });

            res.on('error',function(e){
                console.error('Got error:', e);
            });
            
            res.on('end', function(){
                var strRet, retObj, endTime = +new Date();
                retItem.spent = endTime - retItem.time;
                retItem.status = res.statusCode;

                try{
                    strRet = Buffer.concat(chunks, size).toString();
                    retObj = JSON.parse(strRet);
                    retItem.ret = retObj.ret;
                    retItem.msg = retObj.msg || '';

                    if(strRet.length < 256){
                        retItem.jsonRet = strRet;
                    }

                }catch(err){
                    retItem.msg = err;
                }
                
                retList.push(retItem);

                if(retList.length >= configs.maxRecordCache){
                    save(callback);
                }else{
                    callback && callback();
                }
            });
        });
        req.write(post_data);
        req.end();
    }

    function save(callback){
        var tabName = 'ret_' + moment().format('YYYYMMDD');
        var sqls = 'INSERT INTO `' + tabName + '` (`url`,`params`,`http_code`,`method`,`ret_code`,`msg`,`spent`, `ret_json`) VALUES ';
        var item, sql, arrSqls = [];
        var mysqlConn = mysql.createConnection(configs.mysql);

        mysqlConn.connect();
        createTable(mysqlConn, tabName);
        
        //写入到数据库
        while(retList.length){
            item = retList.shift();
            sql = '("';
            sql += item.url + '","';
            sql += ''=== item.params ?  '","' : (mysqlConn.escape(JSON.stringify(item.params)) + '","');
            sql += item.status + '","';
            sql += item.method + '","';
            sql += item.ret + '","';
            sql += item.msg + '","';
            sql += item.spent + '","';
            sql += mysqlConn.escape(item.jsonRet) + '"';
            sql += ')';
            arrSqls.push(sql);
        }
        
        sqls += arrSqls.join(',') + ';';

        //console.log('sqls = ', sqls);
        
        mysqlConn.query(sqls, function(err){
            if(err){
                console.error(err);
            }
            
            //mysqlConn.destroy();

            mysqlConn.end(function(err) {
                if(err){
                    console.error(err);
                }
            });

            callback && callback();
        }); 
    }

    function createTable(mysqlConn, tabName) {
        var sql = 'CREATE TABLE IF NOT EXISTS `';
        sql += tabName + '`(';
        sql += '`id` int(10) NOT NULL AUTO_INCREMENT,';
        sql += '`url` varchar(128) NOT NULL DEFAULT "",';
        sql += '`params` varchar(128) NOT NULL DEFAULT "",';
        sql += '`http_code` int(10) NOT NULL DEFAULT "0",';
        sql += '`method` varchar(4) NOT NULL DEFAULT "",';
        sql += '`ret_code` int(10) NOT NULL DEFAULT "0",';
        sql += '`msg` varchar(128) NOT NULL DEFAULT "",';
        sql += '`spent` int(10) NOT NULL DEFAULT "0",';
        sql += '`ret_json` varchar(256) NOT NULL DEFAULT "",';
        sql += 'PRIMARY KEY (`id`)';
        //MyISAM引擎 注重写入性能
        sql += ') ENGINE=`MyISAM` AUTO_INCREMENT=1 DEFAULT CHARACTER SET utf8 COLLATE utf8_general_ci ROW_FORMAT=DYNAMIC CHECKSUM=0 DELAY_KEY_WRITE=0;';
        
        mysqlConn.query(sql, function(err, list){
            if(err){
                console.error('created ', tabName, 'failed.', sql, err);
            }
        });
    }

    function runTask(){
        if(!doing){
            ToDo(function(next){
                doing = true;
                sendData(logoutTask, function(params){
                    next(params);
                });
            }).done(function(next){
                sendData(loginTask, function(params){
                    next(params);
                });
            }).done(function(next){
                taskList.forEach(function(task){
                    sendData(task, function(params){
                        next(params);
                    });
                });
            }).done(function(next){
                doing = false;
                myTimer = setTimeout(runTask, configs.interval);
                next();
            });
        }
    }

    if(!module.parent){
        var d = domain.create();

        console.log('monitor start.');
        process.on('uncaughtException', quit);
        
        d.on('error', function(err) {
            console.error(err);
        });
        d.enter();
        process.domain.run(runTask);
    }
})(require('./configs.js'));