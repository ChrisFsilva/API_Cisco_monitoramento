import xapi from 'xapi';



// Mostra mensagem na tela (TV)

function mostrarMensagemTV() {

  xapi.command('UserInterface.Message.TextLine.Display', {

    Text: 'Sala reservada: 14h às 15h | Equipe Técnica',

    Duration: 0

  });

}



mostrarMensagemTV();

