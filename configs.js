/**
 * 常规配置，任务配置
 * 
 * @author hechangmin@gmail.com
 * @date 2014.11
 */

module.exports = {
    host : 'test.test.com',
    port : 9081,

    //下一次任务开始的时间间隔
    interval : 1000,

    //多少结果条数，写入数据库
    maxRecordCache : 5,

    mysql :  {
        host     : '127.0.0.1',
        port     : 3306,
        database : 'pinfo',
        user     : 'root',
        password : 'admin'
    },

    task : [{
            url : '/login/logout'
        },{
            url : '/login/login',
            params : {
                email : '88348324@qq.com',
                password : '88348324'
            }
        },{
            url : '/photo/list'
        },{
            url : '/user/info'
        },{
            url : '/photo/download',
            params : {
                keys: 'aade3a27b4ba74cdd0ca8da7e71cbfbc',
                all: 1
            }
        },{
            url : '//paypal/payment',
            params : {
                productid : 't1TB599',
                callbackurl : 'https://88348324.test.com/'
            }
        }]    
};