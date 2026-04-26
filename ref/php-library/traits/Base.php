<?php
/**
 * Created by PhpStorm.
 * User: standopen
 * Date: 2020/12/3
 * Time: 5:03 PM
 */
namespace app\common\library\traits;

use think\exception\HttpResponseException;
use think\facade\View;
use think\Response;

trait Base
{

    /**
     * 操作错误跳转的快捷方法
     * @access protected
     * @param  mixed $msg 提示信息
     * @param  string $url 跳转的URL地址
     * @param  mixed $data 返回的数据
     * @param  integer $wait 跳转等待时间
     * @param  array $header 发送的Header信息
     * @return void
     */
    protected function error($msg = '', string $url = null, $data = '', int $wait = 3, array $header = [])
    {
        $msg = is_array($msg) ? json_encode($msg) : $msg;

        if (is_null($url)) {
            $url = $this->request->isAjax() ? '' : 'javascript:history.back(-1);';
        } elseif ($url) {
            $url = (strpos($url, '://') || 0 === strpos($url, '/')) ? $url : $this->app->route->buildUrl($url);
        }

        $result = [
            'code' => 0,
            'msg' => $msg,
            'data' => $data,
            'url' => $url,
            'wait' => $wait,
        ];

        if (!$this->isAjax()) {
            $response = view($this->app->config->get('app.dispatch_error_tmpl'), $result);
        } else {
            $response = $this->jerror($msg);
        }
        throw new HttpResponseException($response);
    }

    /**
     * URL重定向  自带重定向无效
     * @access protected
     * @param  string $url 跳转的URL表达式
     * @param  array|integer $params 其它URL参数
     * @param  integer $code http code
     * @param  array $with 隐式传参
     * @return void
     */
    protected function redirect($url, $params = [], $code = 302, $with = [])
    {
        $response = Response::create($url, 'redirect');

        if (is_integer($params)) {
            $code = $params;
            $params = [];
        }

        $response->code($code)->params($params)->with($with);

        throw new HttpResponseException($response);
    }

    /**
     * 获取当前的response 输出类型
     * @access protected
     * @return string
     */
    protected function isAjax()
    {
        return $this->request->isJson() || $this->request->isAjax();
    }

    /**
     * 简化方法
     * @param $key
     * @param $value
     */
    protected function assign($key,$value){
        View::assign($key,$value);
    }

    /**
     * JSON 错误输出
     * @param $errmsg
     * @param string $url
     * @param int $ercode
     * @return \think\response\Json
     */
    protected function jerror($errmsg, $url = '', $ercode = 1)
    {
        $arr = [
            'errcode' => $ercode,
            'errmsg' => $errmsg,
            'url' => $url
        ];
//        return json($arr);
        throw new HttpResponseException(json($arr));
    }

    /**
     * JSON 成功输出
     * @param $errmsg
     * @param array $data
     * @param string $url
     * @return \think\response\Json
     */
    public function jsuccess($errmsg, $data = [], $url = '')
    {
        $arr = [
            'errcode' => 0,
            'errmsg' => $errmsg,
            'data' => $data,
            'url' => $url
        ];
        return json($arr);
    }
}