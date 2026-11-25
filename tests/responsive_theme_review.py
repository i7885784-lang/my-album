"""Full page and dialog review across desktop and seven touch viewport sizes."""
import os
import time
import subprocess
import re
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
base=os.environ.get("TEST_URL","http://127.0.0.1:3200")
screens=Path(os.environ.get("SCREENSHOT_DIR","/workspace/scratch/responsive-screens"))
screens.mkdir(parents=True,exist_ok=True)
long_file="9cn6R3c7JTA5Z_S5zB0xEDtvm9sOCebgrQcw"+"ОченьДлинноеНазваниеФотографииБезПробелов"*4+".jpg"
long_file=long_file[:190]+".jpg"
long_album="Семейный альбом с очень длинным названием "+"Воспоминания"*5
long_album=long_album[:110]
routes=[("Главная","/"),("Альбомы","/albums"),("Все фото","/photos"),("Видео","/videos"),("Избранное","/favorites"),("Воспоминания","/memories"),("Люди","/people"),("Места","/places"),("Теги","/tags"),("Корзина","/trash"),("Настройки","/settings")]

def assert_page(page,theme,label):
    expect(page.locator("html")).to_have_attribute("data-theme",theme)
    assert page.evaluate("document.documentElement.scrollWidth<=innerWidth"),("horizontal overflow",label,page.viewport_size)
    assert page.locator("select").count()==0,label
    assert page.locator(".entity-name").evaluate_all("(nodes)=>nodes.every(e=>e.getBoundingClientRect().right<=e.closest('.entity-card').getBoundingClientRect().right)"),label
    assert page.evaluate("getComputedStyle(document.documentElement).colorScheme")==theme

def bounds(page,selector):
    for r in page.locator(selector).evaluate_all("(nodes)=>nodes.map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}})"):
        assert r["left"]>=-1 and r["right"]<=page.viewport_size["width"]+1,(selector,r,page.viewport_size)
        assert r["top"]>=-1 and r["bottom"]<=page.viewport_size["height"]+1,(selector,r,page.viewport_size)

def visit(page,label,route):
    menu=page.get_by_role("button",name="Меню",exact=True)
    if menu.is_visible():
        menu.click()
        expect(page.locator(".sidebar")).to_have_class(re.compile("open"))
    page.locator(".sidebar").get_by_role("link",name=label,exact=True).click()
    expect(page).to_have_url(base+route)
    expect(page.locator(".sidebar")).not_to_have_class(re.compile("open"))
    if menu.is_visible():
        page.wait_for_function("document.querySelector('.sidebar').getBoundingClientRect().right<=0")

def choose(page,label,option):
    page.get_by_role("button",name=label,exact=True).click()
    page.get_by_role("option",name=option,exact=True).first.click()

def close_dialog(page):
    page.locator("dialog[open]").get_by_role("button",name="Закрыть",exact=True).click()
    expect(page.locator("dialog[open]")).to_have_count(0)

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path="/usr/bin/chromium")
    primary=browser.new_context(viewport={"width":1440,"height":900},accept_downloads=True)
    page=primary.new_page()
    errors=[]
    page.on("pageerror",lambda e:errors.append(str(e)))
    page.goto(base)
    page.get_by_role("button",name="Переключить тему",exact=True).click()
    for name in ["Войти","Создать аккаунт"]:
        page.get_by_role("button",name=name,exact=True).first.click()
        assert_page(page,"dark","public "+name)
        assert page.locator("dialog[open]").evaluate("(e)=>getComputedStyle(e).backgroundColor")=="rgb(44, 35, 55)"
        close_dialog(page)
    page.reload()
    assert_page(page,"dark","public reload")
    page.get_by_role("button",name="Создать аккаунт",exact=True).first.click()
    email="responsive-"+str(time.time_ns())+"@example.test"
    page.locator("dialog").get_by_label("Ваше имя").fill("ОченьДлинноеИмяПользователяДляПроверкиВерстки"+"а"*35)
    page.locator("dialog").get_by_label("Email",exact=True).fill(email)
    page.locator("dialog").get_by_label("Пароль",exact=True).fill("testing-password")
    page.locator("dialog").get_by_role("button",name="Создать аккаунт",exact=True).click()
    expect(page.locator(".sidebar")).to_be_visible()
    assert_page(page,"dark","registration preserves preference")
    page.wait_for_function("localStorage.getItem('album-theme-pending')==='0'")
    assert page.request.get(base+"/api/me").json()["settings"]["theme"]=="dark"
    created={}
    for kind,name in [("albums",long_album),("people","Близкий человек с длинным именем "*2),("places","Наше любимое место с длинным названием"),("tags","Особенные семейные воспоминания")]:
        result=page.request.post(base+"/api/entities/"+kind,data={"name":name,"latitude":55.75 if kind=="places" else None,"longitude":37.61 if kind=="places" else None})
        assert result.status==201,result.text()
        created[kind]=result.json()["id"]
    files=[]
    for i,name in enumerate([long_file,"Фото семьи с длинным названием "+"воспоминания "*8+".jpg","Удалённое фото.jpg"]):
        result=page.request.post(base+"/api/media/upload",multipart={"file":{"name":name,"mimeType":"image/jpeg","buffer":Path("public/assets/"+str(i+1)+".jpg").read_bytes()},"entities":__import__("json").dumps(list(created.values()))})
        assert result.status==201,result.text()
        files.append(result.json()["id"])
    page.request.patch(base+"/api/media/"+files[0],data={"favorite":True})
    page.request.post(base+"/api/media/batch",data={"ids":[files[2]],"action":"trash"})
    page.request.patch(base+"/api/profile/appearance",data={"heroImage":files[0],"heroPosition":60})
    page.request.post(base+"/api/media/"+files[0]+"/comments",data={"text":"Длинный комментарий. "+"Семейная история без переполнения окна. "*18})
    ffmpeg=subprocess.check_output(["node","-e","console.log(require('@ffmpeg-installer/ffmpeg').path)"],text=True).strip()
    fixture=screens/"video.mp4"
    subprocess.run([ffmpeg,"-y","-f","lavfi","-i","color=c=purple:s=160x120:d=2","-c:v","libx264","-threads","1",str(fixture)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    video=page.request.post(base+"/api/media/upload",multipart={"file":{"name":"Семейное видео с длинным названием.mp4","mimeType":"video/mp4","buffer":fixture.read_bytes()}})
    assert video.status==201
    # A theme change must preserve other unsaved settings.
    page.goto(base+"/settings")
    choose(page,"Новые альбомы видны","Только мне")
    page.get_by_role("button",name="Светлая тема",exact=False).click()
    expect(page.locator(".theme-status")).to_contain_text("Тема сохранена")
    expect(page.get_by_role("button",name="Новые альбомы видны",exact=True)).to_contain_text("Только мне")
    expect(page.get_by_role("button",name="Сохранить изменения",exact=True)).to_be_enabled()
    page.get_by_role("button",name="Сохранить изменения",exact=True).click()
    expect(page.locator(".toast")).to_contain_text("Настройки сохранены")
    page.reload()
    assert_page(page,"light","settings reload")
    page.get_by_role("button",name="Тёмная тема",exact=False).click()
    expect(page.locator(".theme-status")).to_contain_text("Тема сохранена")
    page.goto(base+"/photos")
    page.get_by_label("Поиск",exact=True).fill("9cn6")
    expect(page.locator(".result-name")).to_have_count(1)
    assert page.locator(".result-name").evaluate("(e)=>e.scrollWidth>e.clientWidth&&getComputedStyle(e).textOverflow==='ellipsis'")
    bounds(page,".search-results")
    page.screenshot(path=str(screens/"desktop-long-search-dark.png"))
    page.get_by_role("button",name=long_file,exact=True).click()
    expect(page.locator("dialog[open] h2")).to_have_text(long_file)
    assert page.locator("dialog[open] h2").evaluate("(e)=>e.scrollWidth>e.clientWidth&&getComputedStyle(e).textOverflow==='ellipsis'")
    close_dialog(page)
    page.get_by_role("button",name="Настройки профиля",exact=True).click()
    page.get_by_role("button",name="Выйти из аккаунта",exact=True).click()
    expect(page.get_by_role("button",name="Переключить тему",exact=True)).to_be_visible()
    assert_page(page,"dark","logout")
    for name in ["Войти","Создать аккаунт"]:
        page.get_by_role("button",name=name,exact=True).first.click()
        assert_page(page,"dark","auth after logout")
        close_dialog(page)
    primary.close()

    phone_sizes=[(320,568),(360,740),(375,667),(390,844),(412,915),(430,932),(480,960)]
    for width,height in phone_sizes:
        context=browser.new_context(viewport={"width":width,"height":height},is_mobile=True,has_touch=True,device_scale_factor=1)
        phone=context.new_page()
        phone.on("pageerror",lambda e:errors.append(str(e)))
        phone.goto(base)
        phone.get_by_role("button",name="Переключить тему",exact=True).click()
        assert_page(phone,"dark","phone public")
        phone.screenshot(path=str(screens/(str(width)+"-public-dark.png")),full_page=True)
        for name in ["Создать семейный архив","Войти"]:
            phone.get_by_role("button",name=name,exact=True).first.click()
            assert_page(phone,"dark","phone auth")
            bounds(phone,"dialog[open]")
            phone.screenshot(path=str(screens/(str(width)+"-auth-"+("signup" if name!="Войти" else "login")+".png")))
            close_dialog(phone)
        phone.get_by_role("button",name="Войти",exact=True).click()
        phone.locator("dialog").get_by_label("Email",exact=True).fill(email)
        phone.locator("dialog").get_by_label("Пароль",exact=True).fill("testing-password")
        phone.locator("dialog").get_by_role("button",name="Войти",exact=True).click()
        expect(phone.locator(".sidebar")).to_be_attached()
        for theme in ["dark","light"]:
            visit(phone,"Настройки","/settings")
            phone.get_by_role("button",name="Тёмная тема" if theme=="dark" else "Светлая тема",exact=False).click()
            expect(phone.locator(".theme-status")).to_contain_text("Тема сохранена")
            for label,route in routes:
                visit(phone,label,route)
                assert_page(phone,theme,(width,route))
                if route=="/":
                    expect(phone.locator(".entity-list, .list-view")).to_have_count(0)
                phone.screenshot(path=str(screens/(str(width)+"-"+(route.strip("/") or "home")+"-"+theme+".png")),full_page=route in ["/","/settings"])
                phone.evaluate("scrollTo(0,document.body.scrollHeight)")
                assert_page(phone,theme,(width,route,"bottom"))
                phone.evaluate("scrollTo(0,0)")
            phone.get_by_role("button",name="Настройки профиля",exact=True).click()
            expect(phone).to_have_url(base+"/profile")
            assert_page(phone,theme,"phone profile")
            phone.screenshot(path=str(screens/(str(width)+"-profile-"+theme+".png")),full_page=True)
            phone.get_by_role("button",name="Изменить профиль",exact=True).click()
            bounds(phone,"dialog[open]")
            assert phone.locator(".modal-body").evaluate("(e)=>e.scrollWidth<=e.clientWidth")
            phone.screenshot(path=str(screens/(str(width)+"-profile-dialog-"+theme+".png")))
            close_dialog(phone)
            visit(phone,"Все фото","/photos")
            phone.get_by_role("button",name="Список",exact=True).click()
            name=phone.locator(".media-name").filter(has_text="9cn6")
            expect(name).to_be_visible()
            assert name.evaluate("(e)=>e.scrollWidth>e.clientWidth&&getComputedStyle(e).textOverflow==='ellipsis'")
            assert_page(phone,theme,"list")
            phone.get_by_label("Поиск",exact=True).fill("9cn6")
            bounds(phone,".search-results")
            assert phone.locator(".result-name").evaluate("(e)=>e.scrollWidth>e.clientWidth")
            phone.screenshot(path=str(screens/(str(width)+"-search-"+theme+".png")))
            phone.get_by_role("button",name=long_file,exact=True).click()
            phone.wait_for_function("document.querySelector('.viewer-original').style.opacity==='1'")
            bounds(phone,"dialog[open]")
            assert phone.locator(".viewer-tools").evaluate("(e)=>e.scrollWidth<=e.clientWidth")
            assert phone.locator(".viewer-info").evaluate("(e)=>e.scrollWidth<=e.clientWidth")
            phone.locator(".comment-form textarea").scroll_into_view_if_needed()
            phone.screenshot(path=str(screens/(str(width)+"-comments-"+theme+".png")))
            close_dialog(phone)
            for route,label in [("/albums","Создать альбом"),("/people","Добавить человека"),("/places","Добавить место"),("/tags","Создать тег")]:
                visit(phone,dict((r,l) for l,r in routes)[route],route)
                phone.get_by_role("button",name=label,exact=True).click()
                bounds(phone,"dialog[open]")
                assert phone.locator(".modal-body").evaluate("(e)=>e.scrollWidth<=e.clientWidth")
                if route=="/albums":
                    phone.get_by_role("button",name="Обложка / аватар",exact=True).click()
                    bounds(phone,".choice-panel")
                    phone.screenshot(path=str(screens/(str(width)+"-picker-"+theme+".png")))
                    phone.keyboard.press("Escape")
                    phone.get_by_role("button",name="Дата события",exact=True).click()
                    bounds(phone,".calendar-panel")
                    phone.screenshot(path=str(screens/(str(width)+"-calendar-"+theme+".png")))
                    phone.keyboard.press("Escape")
                phone.locator("dialog[open]").get_by_role("button",name="Сохранить",exact=True).scroll_into_view_if_needed()
                bounds(phone,"dialog[open] .modal-actions")
                phone.screenshot(path=str(screens/(str(width)+"-"+route.strip("/")+"-dialog-"+theme+".png")))
                phone.locator("dialog[open]").get_by_role("button",name="Отмена",exact=True).click()
            visit(phone,"Альбомы","/albums")
            phone.get_by_role("button",name="Семейный доступ",exact=True).click()
            bounds(phone,"dialog[open]")
            phone.get_by_role("button",name="Роль приглашённого",exact=True).click()
            bounds(phone,".choice-panel")
            phone.screenshot(path=str(screens/(str(width)+"-family-picker-"+theme+".png")))
            phone.keyboard.press("Escape")
            phone.locator(".join-section input").scroll_into_view_if_needed()
            assert phone.locator(".family-panel").evaluate("(e)=>e.scrollWidth<=e.clientWidth")
            close_dialog(phone)
            phone.locator(".upload-top").click()
            bounds(phone,"dialog[open]")
            assert phone.locator(".modal-body").evaluate("(e)=>e.scrollWidth<=e.clientWidth")
            phone.screenshot(path=str(screens/(str(width)+"-upload-"+theme+".png")))
            close_dialog(phone)
            phone.get_by_role("button",name="Уведомления",exact=True).click()
            bounds(phone,".notification-panel")
            phone.screenshot(path=str(screens/(str(width)+"-notifications-"+theme+".png")))
            phone.get_by_role("button",name="Уведомления",exact=True).click()
        phone.reload()
        assert_page(phone,"light","phone reload persists")
        phone.get_by_role("button",name="Настройки профиля",exact=True).click()
        phone.get_by_role("button",name="Выйти из аккаунта",exact=True).click()
        expect(phone.get_by_role("button",name="Переключить тему",exact=True)).to_be_visible()
        assert_page(phone,"light","phone logout persists")
        phone.get_by_role("button",name="Войти",exact=True).click()
        assert_page(phone,"light","phone login persists")
        close_dialog(phone)
        print("PASS",width,height,"all tabs, dialogs, long names and both themes",flush=True)
        context.close()
    # Rotate phones and check tablet/desktop layouts with the same real archive.
    extra=browser.new_context(viewport={"width":1280,"height":900})
    assert extra.request.post(base+"/api/auth/login",data={"email":email,"password":"testing-password"}).ok
    wide=extra.new_page()
    wide.on("pageerror",lambda e:errors.append(str(e)))
    wide.goto(base)
    for width,height in [(568,320),(740,360),(844,390),(932,430),(768,1024),(1024,768),(1280,800),(1920,1080)]:
        wide.set_viewport_size({"width":width,"height":height})
        for theme in ["dark","light"]:
            visit(wide,"Настройки","/settings")
            wide.get_by_role("button",name="Тёмная тема" if theme=="dark" else "Светлая тема",exact=False).click()
            expect(wide.locator(".theme-status")).to_contain_text("Тема сохранена")
            for label,route in routes:
                visit(wide,label,route)
                assert_page(wide,theme,(width,height,route))
                if route in ["/","/places","/settings"]:
                    wide.screenshot(path=str(screens/(str(width)+"x"+str(height)+"-"+(route.strip("/") or "home")+"-"+theme+".png")),full_page=True)
            wide.get_by_role("button",name="Настройки профиля",exact=True).click()
            assert_page(wide,theme,"rotated/tablet/desktop profile")
        print("PASS",width,height,"landscape/tablet/desktop all tabs and both themes",flush=True)
    extra.close()
    # Migrate a theme set by an older build and synchronize two open tabs.
    legacy=browser.new_context(viewport={"width":1280,"height":900})
    assert legacy.request.post(base+"/api/auth/register",data={"name":"Проверка старой темы","email":"legacy-"+str(time.time_ns())+"@example.test","password":"testing-password"}).ok
    legacy.add_init_script("if(!localStorage.getItem('album-theme'))localStorage.setItem('album-theme','dark')")
    first=legacy.new_page()
    first.goto(base+"/settings")
    first.wait_for_function("localStorage.getItem('album-theme-pending')==='0'")
    assert_page(first,"dark","legacy saved preference")
    assert first.request.get(base+"/api/me").json()["settings"]["theme"]=="dark"
    second=legacy.new_page()
    second.goto(base+"/albums")
    first.get_by_role("button",name="Светлая тема",exact=False).click()
    expect(first.locator(".theme-status")).to_contain_text("Тема сохранена")
    expect(second.locator("html")).to_have_attribute("data-theme","light")
    second.reload()
    assert_page(second,"light","second tab reload")
    first.get_by_role("button",name="Тёмная тема",exact=False).click()
    expect(first.locator(".theme-status")).to_contain_text("Тема сохранена")
    expect(second.locator("html")).to_have_attribute("data-theme","dark")
    legacy.close()
    print("PASS legacy theme migration and synchronization across tabs",flush=True)
    assert not errors,errors
    print("PASS desktop theme lifecycle and seven mobile viewport reviews")
    browser.close()
