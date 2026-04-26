<?php
/**
 * Created by PhpStorm.
 * Date: 2020/11/30
 * Time: 21:00
 * description:
 */
declare (strict_types = 1);

namespace app\api\controller;

use think\App;
use think\exception\HttpResponseException;
use think\facade\Config;
use think\facade\Cookie;
use think\facade\Db;
use think\facade\Request;
use Tools\Auth\Jwt;
use Tools\StRedis;

/**
 * 控制器基础类
 */
abstract class Base
{
    /**
     * Request实例
     * @var \think\Request
     */
    protected $request;

    /**
     * 应用实例
     * @var \think\App
     */
    protected $app;

    /**
     * 是否批量验证
     * @var bool
     */
    protected $batchValidate = false;

    /**
     * 控制器中间件
     * @var array
     */
    protected $middleware = [];

    /**
     * 是否需要登录
     * @var array
     */
    protected $noNeedLogin = [];

    /**
     * token 加密
     * @var string
     */
    private $jwtKey = '';

    /**
     * 用户信息
     * @var int
     */
    protected $uid = 0;
    protected $userInfo = null;

    protected $signKey = '56RDBxZRklaf6KhhpkWaUMOJK8A7kQDW';

    /**
     * 构造方法
     * @access public
     * @param  App  $app  应用对象
     */
    public function __construct(App $app)
    {

        //-- 同步配置
        $configModel = new \app\common\model\Configs();
        Config::set($configModel->getAllArr(), 'config');

        $this->app     = $app;
        $this->request = $this->app->request;

        // 控制器初始化
        $this->initialize();
    }

    // 初始化
    protected function initialize()
    {
        $actionname     = strtolower($this->request->action());
        $testUid = env('app.testuid',0);
        if($testUid > 0){
            $this->uid = $testUid;
            $this->userInfo = Db::name('users')->where('id',$testUid)->find();
        }else{
            $token = $this->getToken();
            if(!empty($token)){
                $this->parseToken($token);
            }
        }

        if(!in_array('*',$this->noNeedLogin) && !in_array($actionname,$this->noNeedLogin) && $this->uid <=0){
            return $this->jerror('请先登录',101);
        }
    }

    private function getToken(){
        $token = $this->request->server('HTTP_AUTHORIZATION', '');
        if(!empty($token)){
            return $token;
        }
        $token = $this->request->request('token','');
        if(!empty($token)){
            return $token;
        }
        $token = Cookie::get('token','');
        if(!empty($token)){
            return $token;
        }
        return '';
    }

    /**
     * 检查请求间隔
     */
    protected function requestLimit($limitTime=3){
        $key = 'request_user_key:'.$this->uid;
        $redis = $this->getRedis();
        $lastTime = $redis->get($key);
        if($lastTime && time() - $lastTime < $limitTime){
            return $this->jerror('请求频繁');
        }
        $redis->set($key,time(),$limitTime*2);
    }

    protected function clearRequestLimit(){
        $key = 'request_user_key:'.$this->uid;
        $redis = $this->getRedis();
        $redis->del($key);
    }


    /**
     * 解析token
     * @param $token
     * @return array
     */
    private function parseToken($token){
        try{
            $jwt = new Jwt();
            $result = $jwt->decode($token,Config::get('config.JWT_KEY'));
            if (!$result || !isset($result['uid']) || !isset($result['user_key'])) {
                $this->uid = 0;
                return [1,'登录状态失效'];
            }

            $userInfo = Db::name('users')
                ->where('id',$result['uid'])
                ->where('status',1)
                ->find();

            if(!$userInfo || md5(md5($userInfo['mobile'].$userInfo['id'])) !== $result['user_key']){
                $this->uid = 0;
                return [1,'该用户不存在'];
            }
            $this->userInfo = $userInfo;
            $this->uid = $userInfo['id'];
            return [0,$userInfo];
        }catch (\Exception $e){
            $this->jerror($e->getMessage());
        }
    }


    protected function getRedis(){
        static $redis = null;
        if($redis){
            return $redis;
        }
        $redis = new StRedis();
        return $redis;
    }

    protected function getHost(){
        return 'https://' . Request::instance()->host();
    }

    protected function getHttpsHost(){
        return 'https://' . Request::instance()->host();
    }

    protected function parsepic($path){
        //http://app.kangaroo-japan.com
        if(stripos($path,'http://') !== false){
            return str_replace('http://','https://',$path);
        }

        if(stripos($path,'http') !== false){
            return $path;
        }
        return $this->getHost().'/'.ltrim($path,'/');
    }


    /**
     * JSON 错误输出
     * @param $errmsg
     * @param int $ercode
     * @return \think\response\Json
     */
    protected function jerror($errmsg, $ercode = 1)
    {
        $arr = [
            'code' => $ercode,
            'errmsg' => $errmsg,
        ];
        header('Content-Type:application/json');
        echo json($arr)->getContent();
        exit();
//        throw new HttpResponseException(json($arr));
    }

    /**
     * JSON 成功输出
     * @param $errmsg
     * @param array $data
     * @param string $url
     * @return \think\response\Json
     */
    public function jsuccess($errmsg, $data = [])
    {
        $arr = [
            'code' => 0,
            'errmsg' => $errmsg,
            'data' => $data,
        ];
        header('Content-Type:application/json');
        echo json($arr)->getContent();
        exit();
//        return json($arr);
    }


    public function jecho($data = [])
    {
        header('Content-Type:application/json');
        echo json($data)->getContent();
        exit();
//        return json($arr);
    }



}