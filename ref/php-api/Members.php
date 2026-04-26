<?php
/**
 * Created by PhpStorm.
 * Date: 2020/12/1
 * Time: 00:09
 * description:
 */

namespace app\common\model;

use think\Exception;
use think\exception\ValidateException;
use think\helper\Str;
use think\Model;
use Tools\Auth\Jwt;

class Members extends Model
{
    protected $table = 'st_member';

    public static $loginRules = ['email' => 'require|email', 'password' => 'require', 'verify|验证码' => 'require|captcha'];
    public static $loginMessage = ['email.require' => '请输入邮箱', 'password.require' => '请输入密码'];


    protected $autoWriteTimestamp = true;
    /**
     * 验证规则
     * @var array
     */
    public $rules = [
        'default' => [
            'username|用户名' => 'require',
            'email|邮箱' => 'require|email',
            'rid|角色' => 'number',
            'status|状态' => 'number',
            'avatar|头像' => 'require',
            'phone|手机号' => 'require'
        ],
        'update' => [
            'uid|用户标志' => 'require|number',
            'avatar|头像' => 'require',
            'phone|手机号' => 'require'
        ]
    ];
    /**
     * 错误提示
     * @var array
     */
    public $errMsg = [
    ];

    /**
     * 新增和编辑
     * @param $params
     * @return array
     */
    public function addRow($params, $mode = 'default')
    {
        try {
            \validate($this->rules[$mode], $this->errMsg)->failException(true)->check($params);
            $allowField = ['username', 'email', 'avatar', 'phone', 'rid', 'status', 'realname', 'remark','order_cats'];
            $data = filter_data($params, $allowField);
            $id = isset($params['uid']) ? intval($params['uid']) : 0;

            if ($mode !== 'update') {
                //-- 判断邮箱是否存在
                $exist = $this
                    ->where('uid', '<>', $id)
                    ->where('email', '=', $data['email'])
                    ->find();
                if ($exist) {
                    return [1, '该邮箱已存在'];
                }

                //-- 判断用户名是否存在
                $exist = $this
                    ->where('uid', '<>', $id)
                    ->where('username', '=', $data['username'])
                    ->find();
                if ($exist) {
                    return [1, '该用户名已存在'];
                }
            }


            //-- 检查密码
            if (!empty($params['password'])) {
                $score = $this->checkPassword($params['password']);
                if ($score < 6) {
                    return [1, '密码强度太弱'];
                }
                $salt = self::_getSalt();
                $data['password'] = self::_makePassword($params['password'], $salt);
                $data['salt'] = $salt;
            }

            if ($id > 0) {
                $info = $this->where(['uid' => $id, 'is_deleted' => 0])->find();
                if (!$info) {
                    return [1, '该账号不存在'];
                }
                $res = $info->save($data);
            }
            else {
                if (empty($data['password'])) {
                    return [1, '请输入密码'];
                }
                $data['reg_ip'] = get_client_ip();
                $res = $this
                    ->save($data);
            }
            if ($res !== false) {
                return [0, '操作成功'];
            }
            return [1, '操作失败请稍后再试'];
        }
        catch (ValidateException $e) {
            return [1, $e->getMessage()];
        }
        catch (Exception $e) {
            return [1, $e->getMessage()];
        }
    }

    /**
     * 判断密码重点级别
     * @return [type] [description]
     */
    public function checkPassword($password)
    {
        $score = 0;
        if (strlen($password) < 6) {
            return $score;
        }

        if (preg_match("/[0-9]+/", $password)) {
            $score++;
        }
        if (preg_match("/[0-9]{3,}/", $password)) {
            $score++;
        }
        if (preg_match("/[a-z]+/", $password)) {
            $score++;
        }
        if (preg_match("/[a-z]{3,}/", $password)) {
            $score++;
        }
        if (preg_match("/[A-Z]+/", $password)) {
            $score++;
        }
        if (preg_match("/[A-Z]{3,}/", $password)) {
            $score++;
        }
        if (preg_match("/[_|\-|+|=|*|!|@|#|$|%|^|&|(|)]+/", $password)) {
            $score += 2;
        }
        if (preg_match("/[_|\-|+|=|*|!|@|#|$|%|^|&|(|)]{3,}/", $password)) {
            $score++;
        }
        if (strlen($password) >= 10) {
            $score++;
        }
        return $score;
    }


    /**
     * 登录
     * @param $email
     * @param $password
     * @return array
     */
    public function doLogin($email, $password, $remember)
    {
        $info = $this
            ->where('email',$email)
            ->where('is_deleted',0)
            ->find();
        if (!$info) {
            return array(1, '该账号不存在');
        }
        $salt = $info['salt'];
        if (empty($salt)) {
            return array(1, '密码错误');
        }

        $userPassword = self::_makePassword($password, $salt);
        if ($info['password'] !== $userPassword) {
            return array(1, '密码错误');
        }

        if ($info['status'] == 0) {
            return array(1, '你的账号已被禁用,请联系管理员解封');
        }

        $data = array(
            'login' => $info['login'] + 1,
            'last_login_time' => time(),
            'last_login_ip' => get_client_ip()
        );
        $info->save($data);

        //-- 登录日志
        event('AdminLogin', $info);

        $cacheUser = ['uid' => $info['uid'], 'time' => date('Y-m-d H:i:s', time()),'order_cats' => $info['order_cats'], 'username' => $info['username'], 'rid' => $info['rid'], 'avatar' => $info['avatar'], 'pwd' => sha1($info['password'])];
        self::_setLogin($cacheUser, $remember);
        return [0, $info];
    }

    /**
     * 判断是否登陆
     * @return array|boolean
     */
    public static function _isLogin()
    {
        $userInfo = session("st_admin_info");
        if (empty($userInfo)) {
            $token = cookie('admin_token');
            if (empty($token)) {
                return false;
            }
            $jwt = new Jwt();
            $decoded = $jwt->decode($token, ENCRYPT_KEY);
//            if (empty($decoded) || $decoded['ip'] !== get_client_ip() || time() - $decoded['time'] > 3 * 86400) {
            if (empty($decoded) || time() - $decoded['time'] > 3 * 86400) {
                self::_logout();
                return false;
            }
            //-- 验证密码
            $umodel = new Members();
            $uinfo = $umodel->where(['uid' => intval($decoded['uid']), 'status' => 1])->find();
            if (!$uinfo) {
                self::_logout();
                return false;
            }
            if (sha1($uinfo['password']) !== $decoded['pwd']) {
                self::_logout();
                return false;
            }
            unset($decoded['pwd']);
            session('st_admin_info', $decoded);
            return $decoded;
        }
        return $userInfo;
    }

    /**
     * 设置缓存登陆
     * @param $user
     * @param $user_id
     */
    public static function _setlogin($user, $remember = 0)
    {
        session("st_admin_info", $user);
        if ($remember) {
            $jwt = new Jwt();
            $user['ip'] = get_client_ip();
            $user['time'] = time();
            $token = $jwt->encode($user, ENCRYPT_KEY);
            cookie('admin_token', $token, 86400 * 3);
        }
    }


    /**
     * 退出登陆
     */
    public static function _logout()
    {
        session('st_admin_info', null);
        cookie('admin_token', null, -1);
    }

    /**
     * 加密密码所需要的盐
     * @return string
     */
    public static function _getSalt()
    {
        return Str::random(6);
    }


    public static function _valideUserName($user_name)
    {
        if (preg_match("/[\'.,:;*?~`!@#$%^&+=)(<>{}]|\]|\[|\/|\\\|\"|\|/", $user_name)) {
            return true;
        }
        return false;
    }

    /**
     * 生密码
     * @param $password
     * @param $salt
     * @return string
     */
    public static function _makePassword($password, $salt)
    {
        return sha1(md5($password) . $salt);
    }

}