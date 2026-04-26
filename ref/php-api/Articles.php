<?php
/**
 * Created by PhpStorm.
 * Date: 2021/9/8
 * Time: 15:43
 * description:
 */

namespace app\api\controller;

use think\App;
use think\facade\Db;

class Articles extends Base
{
    public function __construct(App $app)
    {
        $this->noNeedLogin = ['*'];
        parent::__construct($app);
    }

    /**
     * 获取文章列表
     */
    public function index()
    {
        $cat = input('cat', '');
        $result = Db::name('articles')
            ->where('cat', intval($cat))
            ->where('is_show', 1)
            ->where('is_deleted', 0)
            ->field('title,id,cover,description')
            ->order('sort desc,id desc')
            ->paginate(20)->toArray();
        $articleList = $result['data'];
        foreach ($articleList as &$art) {
            $art['cover'] = $this->parsepic($art['cover']);
        }
        return $this->jsuccess('ok', ['list' => $articleList, 'totalPages' => ceil($result['total'] / 20)]);
    }

    /**
     * 获取文章列表
     */
    public function helps()
    {
        $cat = input('cat', '');
        $result = Db::name('articles')
            ->where('cat', intval($cat))
            ->where('is_show', 1)
            ->where('is_deleted', 0)
            ->field('title,id,cover,content')
            ->order('sort desc,id desc')
            ->paginate(100)->toArray();
        $articleList = $result['data'];
        foreach ($articleList as &$art) {
            $art['cover'] = $this->parsepic($art['cover']);
        }
        return $this->jsuccess('ok', ['list' => $articleList, 'totalPages' => ceil($result['total'] / 20)]);
    }

    /**
     * 获取文章详情
     */
    public function detail()
    {
        $id = input('id', '');
        if (intval($id) <= 0) {
            return $this->jerror('该文章不存在');
        }
        $result = Db::name('articles')
            ->where('id', intval($id))
            ->where('is_show', 1)
            ->where('is_deleted', 0)
            ->field('title,id,cover,description,content,click,create_time')
            ->find();
        if (!$result) {
            return $this->jerror('该文章不存在');
        }
        $result['content'] = stripslashes($result['content']);
        return $this->jsuccess('ok', $result);
    }
}