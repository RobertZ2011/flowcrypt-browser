
/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch, Env, Dict } from './../../../js/common/common.js';
import { Ui } from '../../../js/common/browser.js';
import { Store } from '../../../js/common/store.js';
import { BrowserMsg } from '../../../js/common/extension.js';

Catch.try(async () => {

  Ui.event.protect();

  let urlParams = Env.urlParams(['account_email', 'parent_tab_id']); // placement: compose||settings
  let account_email = Env.urlParamRequire.string(urlParams, 'account_email');
  let parent_tab_id = Env.urlParamRequire.string(urlParams, 'parent_tab_id');

  let save_footer_if_has_subscription_and_requested = async (requested: boolean, footer: string) => {
    let subscription = await Store.subscription();
    if (requested && subscription.active) {
      await Store.set(account_email, { email_footer: footer });
    }
  };

  let subscription = await Store.subscription();
  if (subscription.active) {
    let storage = await Store.getAccount(account_email, ['email_footer']);
    $('.input_email_footer').val(storage.email_footer as string);
    $('.user_subscribed').css('display', 'block');
  } else {
    $('.user_free').css('display', 'block');
    $('.action_upgrade').click(Ui.event.prevent('double', async target => {
      let newly_active = await BrowserMsg.sendAwait(parent_tab_id, 'subscribe', {});
      if (newly_active) {
        $('.user_subscribed').css('display', 'block');
        $('.user_free').css('display', 'none');
      }
    }));
  }

  $('.action_add_footer').click(Ui.event.prevent('double', async self => {
    await save_footer_if_has_subscription_and_requested($('.input_remember').prop('checked'), $('.input_email_footer').val() as string); // is textarea
    BrowserMsg.send(parent_tab_id, 'set_footer', {footer: $('.input_email_footer').val()});
  }));

  $('.action_cancel').click(Ui.event.handle(() => BrowserMsg.send(parent_tab_id, 'close_dialog')));

})();