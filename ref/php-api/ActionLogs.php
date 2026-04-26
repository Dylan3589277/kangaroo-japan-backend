<?php
/**
 * Created by PhpStorm.
 * Date: 2020/12/6
 * Time: 00:34
 * description:
 */

namespace app\common\model;

use think\facade\Config;
use think\facade\Request;
use think\Model;

class ActionLogs extends Model
{
    protected $table = 'st_action_log';
    protected $autoWriteTimestamp = true;

    public function addLog($userInfo)
    {
        $logPaths = Config::get('config.ADMIN_LOG_PATH');
        $logArr = empty($logPaths)?[]:explode(PHP_EOL,$logPaths);
        $param = Request::param();
        if(empty($param) && empty($logArr)){
            //-- 没有参数则不做记录,后期看情况而定,要不然增长太快
            return;
        }
        $path = Request::controller() . '/' . Request::action();
        if(!in_array(strtolower($path),$logArr)){
            return;
        }
        $menuModel = new Menus();
        $minfo = $menuModel->where('url', '=', strtolower($path))->find();
        $data = [
            'username' => $userInfo['username'],
            'uid' => $userInfo['uid'],
            'path' => strtolower($path),
            'method' => Request::method(),
            'pagename' => $minfo ? $minfo['title'] : '暂时未设置标题',
            'content' => json_encode($param,JSON_UNESCAPED_UNICODE),
            'ip' => Request::ip(),
            'useragent' => Request::header('user-agent'),
            'create_time' => time()
        ];
        return $this->insert($data);
    }

    /**
     * 用来记录系统脚本日志
     * @param $pageTitle
     * @param array $param
     * @return bool
     */
    public static function addSystemLog($pageTitle,$path,$param = [],$remark='robot'){
        $data = [
            'username' => '系统脚本',
            'uid' => 1,
            'path' => $path,
            'method' => 'POST',
            'pagename' => $pageTitle,
            'content' => json_encode($param,JSON_UNESCAPED_UNICODE),
            'ip' => '127.0.0.1',
            'useragent' => $remark,
            'create_time' => time()
        ];
        return (new ActionLogs())->insert($data);
    }
}